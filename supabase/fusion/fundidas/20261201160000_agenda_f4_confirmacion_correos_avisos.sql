-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F4 — confirmación por enlace, reagendar, correos de cita y
-- avisos de la clínica (archivo fundido, 5.º de 6)
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE
--   · cita_confirmaciones: el enlace de confirmación de cada cita y la última
--     respuesta del paciente (confirmo / cancelo). cita_confirmacion_coincide,
--     _emitir, _revocar, _contexto (lo que lee /confirmar) y _responder (lo
--     único que cambia el estado, desde el POST de un botón).
--   · Reagendar: por el paciente (cita_reagendos, cita_reagendar_oferta,
--     reagendar_por_enlace) y por la clínica (cita_reagendar_clinica).
--   · cita_correos: envíos de comprobante, recordatorio y confirmación
--     (cita_correo_tomar, cita_correo_marcar, cita_recordatorios_pendientes) y
--     el nombre del saludo del recordatorio (cita_nombre_saludo).
--   · avisos_clinica (7 tipos) con aviso_clinica_revisar y los seis
--     aviso_clinica_de_*, colgados de appointments, cita_confirmaciones,
--     cita_reagendos, reserva_empalmes_google y gcal_movimientos_rechazados.
-- DEPENDE DE (lo comprueba el pre-vuelo; aborta si falta)
--   · F1: agenda_ajustes (agenda_v2_encendida, recordatorio_horas,
--     recordatorio_encendido, candado_reagendados), agenda_v2_encendida(uuid)
--     INVOKER y log_cita_change() con 'enlace_paciente' en su lista c_vias.
--   · F2: gcal_sync_clinica_habilitada(uuid) (puerta S3),
--     appointments.google_asignacion, reserva_empalmes_google y
--     gcal_movimientos_rechazados.
--   · F3: appointments.reserva_*, reserva_enlaces (con pausado_en) y
--     reservar_por_enlace(…14…).
--   · main: clinicas.suspendida, clinica_no_suspendida() (md5 normalizado
--     588de29d: contexto, responder, oferta y reagendar copian su predicado
--     con la clínica por parámetro), get_clinica_id() DEFINER,
--     log_tabla_change(), profiles, pacientes, consultorios y audit_log.
-- APLICACIÓN: como postgres (dueño de las funciones DEFINER y de las tablas),
--   de una vez, con psql -v ON_ERROR_STOP=1 o en el SQL Editor. Una sola
--   transacción. RE-EJECUCIÓN: ABORTA LIMPIO en el pre-vuelo si ya existe
--   cualquier objeto de F4; no se deja nada a medias.
-- BLOQUEOS (lock_timeout 5 s): las FK nuevas y los CREATE TRIGGER toman SHARE
--   ROW EXCLUSIVE un instante sobre appointments, clinicas, profiles,
--   reserva_empalmes_google y gcal_movimientos_rechazados (frena escrituras de
--   citas un instante, no lecturas). Tablas nuevas vacías: índices
--   instantáneos. El resto es catálogo.
-- RIESGO: medio. Abre dos caminos SIN sesión que escriben appointments con
--   service_role (responder y reagendar_por_enlace) y cuelga un disparador
--   AFTER INSERT de appointments: si fallara, fallaría el alta de la cita que
--   lo dispara (misma transacción).
-- CÓMO SE DESHACE: supabase/reversas/20261201160000_agenda_f4_confirmacion_correos_avisos_reversa.sql
--   (aborta si alguna de las cuatro tablas tiene filas: respaldar antes).
--
-- CONTRATOS QUE ESTE ARCHIVO CUMPLE (no cambiar sin el otro lado)
--   · spinus.via = 'enlace_paciente' lo ponen SÓLO cita_confirmacion_responder
--     (antes de su UPDATE de la cita, al confirmar y al cancelar) y
--     reagendar_por_enlace (alrededor del UPDATE de reserva_reagendados, y lo
--     vacía después). set_config(…, true) dura hasta el fin de la
--     transacción. log_cita_change (F1) sólo lo escribe sin auth.uid().
--   · spinus.reagendar_cita lo pone cita_reagendar_clinica con el id de la
--     cita sólo para su UPDATE y lo vacía; cita_proteger_eleccion (F5b) lo lee.
--   · Candados consultivos: 1791 (emitir y revocar de la MISMA cita no se
--     intercalan) y 1792 (tomas de correo de la misma cita), los dos con
--     hashtext(cita_id). No reutilizar estas claves ni la 1790 (F3).
--   · El WHEN de trg_appointments_aviso_clinica usa reserva_enlace_id y el
--     literal 'por_asignar', la MISMA marca que cita_asignacion_google (F2),
--     cambioPuedeAvisar y esPorAsignar (src).
--   · avisos_clinica_tipo_check = TIPOS_AVISO de src/lib/avisos/avisosClinica.ts
--     (7 tipos); leerAvisosClinica pide sólo los tipos conocidos.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $pre$
DECLARE
  -- md5(prosrc con espacios normalizados) de clinica_no_suspendida() (main), la que se copia.
  c_no_susp CONSTANT text := '588de29d551f6d474eb24346748e1148';
  c_mias CONSTANT text[] := ARRAY['aviso_clinica_de_cita', 'aviso_clinica_de_confirmacion', 'aviso_clinica_de_empalme',
    'aviso_clinica_de_movimiento_google', 'aviso_clinica_de_reagendo', 'aviso_clinica_de_respuesta', 'aviso_clinica_revisar',
    'cita_confirmacion_coincide', 'cita_confirmacion_contexto', 'cita_confirmacion_emitir', 'cita_confirmacion_responder',
    'cita_confirmacion_revocar', 'cita_correo_marcar', 'cita_correo_tomar', 'cita_correos_pendientes', 'cita_nombre_saludo',
    'cita_reagendar_clinica', 'cita_reagendar_oferta', 'cita_recordatorios_pendientes', 'reagendar_por_enlace'];
  v_falta text;
  v_p     oid;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: aplicar como postgres (es %). Las funciones DEFINER de los avisos tienen que ser de postgres.', current_user;
  END IF;

  -- Re-ejecución: ABORTA LIMPIO si ya hay algo de F4.
  IF to_regclass('public.cita_confirmaciones') IS NOT NULL OR to_regclass('public.cita_reagendos') IS NOT NULL
     OR to_regclass('public.cita_correos') IS NOT NULL OR to_regclass('public.avisos_clinica') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY (c_mias))
     OR EXISTS (SELECT 1 FROM pg_trigger t WHERE NOT t.tgisinternal
                  AND t.tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica',
                                   'trg_gcal_movimientos_aviso_clinica')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: F4 ya está aplicada (o hay objetos con sus nombres). No se repite: revisar a mano.';
  END IF;

  -- Columnas de main y de F1, F2 y F3 que leen o escriben las funciones de
  -- este archivo, con su tipo.
  SELECT string_agg(e.t || '.' || e.c, ', ') INTO v_falta
    FROM (VALUES
    ('agenda_ajustes', 'agenda_v2_encendida', 'boolean'), ('agenda_ajustes', 'candado_reagendados', 'integer'),
    ('agenda_ajustes', 'clinica_id', 'uuid'), ('agenda_ajustes', 'recordatorio_encendido', 'boolean'),
    ('agenda_ajustes', 'recordatorio_horas', 'integer'), ('appointments', 'all_day', 'boolean'),
    ('appointments', 'client_id', 'text'), ('appointments', 'clinica_id', 'uuid'),
    ('appointments', 'consultorio_direccion', 'text'), ('appointments', 'consultorio_id', 'uuid'),
    ('appointments', 'consultorio_nombre', 'text'), ('appointments', 'consultorio_nombre_corto', 'text'),
    ('appointments', 'consultorio_telefono', 'text'), ('appointments', 'consultorio_timezone', 'text'),
    ('appointments', 'end_time', 'timestamp with time zone'), ('appointments', 'gcal_etag', 'text'),
    ('appointments', 'google_asignacion', 'text'), ('appointments', 'google_event_id', 'text'),
    ('appointments', 'id', 'uuid'), ('appointments', 'medico_id', 'uuid'), ('appointments', 'paciente_id', 'uuid'),
    ('appointments', 'reserva_canal', 'text'), ('appointments', 'reserva_correo', 'text'),
    ('appointments', 'reserva_correo_hmac', 'text'), ('appointments', 'reserva_enlace_id', 'uuid'),
    ('appointments', 'reserva_nombre', 'text'), ('appointments', 'reserva_reagendados', 'smallint'),
    ('appointments', 'start_time', 'timestamp with time zone'), ('appointments', 'status', 'text'),
    ('appointments', 'updated_at', 'timestamp with time zone'), ('audit_log', 'accion', 'text'),
    ('audit_log', 'descripcion', 'text'), ('audit_log', 'registro_id', 'uuid'), ('audit_log', 'tabla', 'text'),
    ('audit_log', 'user_id', 'text'), ('clinicas', 'id', 'uuid'), ('clinicas', 'suspendida', 'boolean'),
    ('consultorios', 'activo', 'boolean'), ('consultorios', 'clinica_id', 'uuid'),
    ('consultorios', 'direccion', 'text'), ('consultorios', 'id', 'uuid'), ('consultorios', 'medico_id', 'uuid'),
    ('consultorios', 'nombre', 'text'), ('consultorios', 'nombre_corto', 'text'),
    ('consultorios', 'telefono', 'text'), ('consultorios', 'timezone', 'text'),
    ('gcal_movimientos_rechazados', 'cita_id', 'uuid'), ('gcal_movimientos_rechazados', 'clinica_id', 'uuid'),
    ('pacientes', 'activo', 'boolean'), ('pacientes', 'clinica_id', 'uuid'), ('pacientes', 'email', 'text'),
    ('pacientes', 'id', 'uuid'), ('pacientes', 'nombre', 'text'), ('profiles', 'apellido_materno', 'text'),
    ('profiles', 'apellido_paterno', 'text'), ('profiles', 'clinica_id', 'uuid'),
    ('profiles', 'es_admin_de_clinica', 'boolean'), ('profiles', 'id', 'uuid'), ('profiles', 'nombres', 'text'),
    ('profiles', 'role', 'text'), ('profiles', 'titulo', 'text'),
    ('reserva_empalmes_google', 'cita_reserva_id', 'uuid'), ('reserva_empalmes_google', 'clinica_id', 'uuid'),
    ('reserva_enlaces', 'clase', 'text'), ('reserva_enlaces', 'clinica_id', 'uuid'),
    ('reserva_enlaces', 'codigo_hash', 'text'), ('reserva_enlaces', 'id', 'uuid'),
    ('reserva_enlaces', 'medico_id', 'uuid'), ('reserva_enlaces', 'pausado_en', 'timestamp with time zone'),
    ('reserva_enlaces', 'revocado_en', 'timestamp with time zone')) AS e(t, c, tipo)
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || e.t) AND a.attname = e.c AND NOT a.attisdropped
                        AND format_type(a.atttypid, a.atttypmod) = e.tipo);
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan columnas (o tienen otro tipo): %. ¿Corrieron F1, F2 y F3?', v_falta;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.clinicas'::regclass AND attname = 'suspendida'
                   AND attnotnull AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                      AND attname = 'agenda_v2_encendida' AND attnotnull AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.agenda_ajustes'::regclass AND contype IN ('u', 'p')
                      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                                                                         AND attname = 'clinica_id')]) THEN
    -- Con estas tres, «NOT agenda_v2_encendida(x)» dice lo mismo que el
    -- «NOT EXISTS (… AND j.agenda_v2_encendida)» que sustituye.
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinicas.suspendida o agenda_ajustes.agenda_v2_encendida admiten NULL, o agenda_ajustes.clinica_id no es único.';
  END IF;

  -- main.
  IF (SELECT md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) FROM pg_proc p
       WHERE p.oid = to_regprocedure('public.clinica_no_suspendida()')) IS DISTINCT FROM c_no_susp THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_no_suspendida() no es la que copian contexto, responder, oferta y reagendar. Revisar la copia antes de aplicar.';
  END IF;
  IF NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')), false)
     OR to_regprocedure('public.log_tabla_change()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta log_tabla_change() o auth.uid(), o get_clinica_id() no es SECURITY DEFINER (las policies recursarían).';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin BYPASSRLS; las funciones INVOKER no verían las filas.';
  END IF;
  -- Una por privilegio: con una lista, has_table_privilege da true si tiene CUALQUIERA.
  IF NOT (has_table_privilege('service_role', 'public.appointments', 'SELECT')
          AND has_table_privilege('service_role', 'public.appointments', 'UPDATE')
          AND has_table_privilege('service_role', 'public.profiles', 'SELECT')
          AND has_table_privilege('service_role', 'public.pacientes', 'SELECT')
          AND has_table_privilege('service_role', 'public.consultorios', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinicas', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.reserva_enlaces', 'SELECT')
          AND has_table_privilege('service_role', 'public.audit_log', 'INSERT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin los privilegios que usan las funciones INVOKER.';
  END IF;

  -- Bloques anteriores.
  v_p := to_regprocedure('public.agenda_v2_encendida(uuid)');
  IF v_p IS NULL OR (SELECT prosecdef OR prorettype <> 'boolean'::regtype FROM pg_proc WHERE oid = v_p)
     OR NOT has_function_privilege('service_role', v_p, 'EXECUTE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_v2_encendida(uuid) de F1, no es INVOKER boolean o service_role no la ejecuta.';
  END IF;
  v_p := to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)');
  IF v_p IS NULL OR NOT has_function_privilege('service_role', v_p, 'EXECUTE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la puerta S3 gcal_sync_clinica_habilitada(uuid) de F2 (o service_role no la ejecuta).';
  END IF;
  IF to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reservar_por_enlace(…14…) de F3 (la llama reagendar_por_enlace).';
  END IF;
  -- Contrato con F1: el «via» que ponen responder y reagendar se audita.
  IF position('''enlace_paciente''' IN coalesce((SELECT prosrc FROM pg_proc
                                                  WHERE oid = to_regprocedure('public.log_cita_change()')), '')) = 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change() (F1) no existe o no tiene enlace_paciente en su lista c_vias.';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------
-- 2 · cita_confirmaciones: el enlace Y la respuesta del paciente.
-- ---------------------------------------------------------------------
-- EL CÓDIGO NO SE GUARDA: se deriva como HMAC(subllave «confirmacion» de
-- RESERVA_SECRETO, 'confirmacion:' || id) (src/lib/reserva/secretos.ts) y aquí
-- sólo vive sha256(código). UNIQUE(codigo_hash) global a propósito: la
-- búsqueda no conoce la clínica y un choque exige adivinar 128 bits.
-- paciente_id SIN FK a propósito: una FK RESTRICT haría fallar el borrado de
-- un paciente sin historial (appointments.paciente_id es SET NULL) y SET
-- NULL/CASCADE no se permiten. Si el paciente cambia o se borra, el enlace
-- deja de coincidir: falla cerrado. La caducidad no se guarda: la decide la
-- cita VIGENTE (vale mientras no empiece; cancelar, hasta 1 h antes).
CREATE TABLE public.cita_confirmaciones (
  id                  uuid        NOT NULL,
  clinica_id          uuid        NOT NULL,
  appointment_id      uuid        NOT NULL,
  codigo_hash         text        NOT NULL,
  paciente_id         uuid,
  reserva_correo_hmac text,
  creado_por          uuid,
  respuesta           text,
  respondido_en       timestamptz,
  revocado_en         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_confirmaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cita_confirmaciones_codigo_key UNIQUE (codigo_hash),
  CONSTRAINT cita_confirmaciones_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_confirmaciones_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_confirmaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT cita_confirmaciones_codigo_check CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  -- Exactamente uno de los dos vínculos (IS NOT NULL explícito: un CHECK que da NULL pasa).
  CONSTRAINT cita_confirmaciones_vinculo_check CHECK ((paciente_id IS NOT NULL) <> (reserva_correo_hmac IS NOT NULL)),
  CONSTRAINT cita_confirmaciones_hmac_check CHECK (reserva_correo_hmac IS NULL OR reserva_correo_hmac ~ '^[0-9a-f]{64}$'),
  CONSTRAINT cita_confirmaciones_respuesta_check CHECK (
    (respuesta IS NULL AND respondido_en IS NULL)
    OR (respuesta IS NOT NULL AND respuesta IN ('confirmo', 'cancelo') AND respondido_en IS NOT NULL))
);

-- UN enlace vigente por cita.
CREATE UNIQUE INDEX cita_confirmaciones_vigente ON public.cita_confirmaciones (appointment_id)
  WHERE revocado_en IS NULL;
-- Para la FK RESTRICT (borrar una cita busca aquí por appointment_id, revocados incluidos).
CREATE INDEX cita_confirmaciones_cita ON public.cita_confirmaciones (appointment_id);
CREATE INDEX cita_confirmaciones_respuestas ON public.cita_confirmaciones (clinica_id, respondido_en DESC)
  WHERE respondido_en IS NOT NULL;

ALTER TABLE public.cita_confirmaciones ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan casi todo a los tres roles.
REVOKE ALL ON TABLE public.cita_confirmaciones FROM PUBLIC, anon, authenticated, service_role;
-- Sin codigo_hash, sin los dos vínculos y sin creado_por: el personal ve QUÉ respondió el paciente, nada más.
GRANT SELECT (id, clinica_id, appointment_id, respuesta, respondido_en, revocado_en, created_at)
  ON TABLE public.cita_confirmaciones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cita_confirmaciones TO service_role;

-- Sin recursión: lee appointments, no cita_confirmaciones; el EXISTS corre
-- bajo la RLS de appointments de quien pregunta (el invitado, sólo las suyas).
-- Sin policy de escritura: authenticated no tiene INSERT ni UPDATE.
CREATE POLICY cita_confirmaciones_select ON public.cita_confirmaciones FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_confirmaciones.appointment_id AND a.clinica_id = public.get_clinica_id()));

COMMENT ON TABLE public.cita_confirmaciones IS
  'Enlace de confirmación por cita y la última respuesta del paciente (agenda E1). El código NO se guarda: HMAC(subllave confirmacion de RESERVA_SECRETO, ''confirmacion:''||id); aquí sólo sha256. Uno vigente por cita; se revoca, nunca se borra. CONVENIO (dimensión 16): paciente_id SIN FK a propósito (ver la migración); el enlace vale si coincide con el paciente vigente de la cita o, en una cita por ligar, con su reserva_correo_hmac (cita_confirmacion_coincide). Sólo escriben las funciones cita_confirmacion_*; rotar RESERVA_SECRETO invalida todos.';
COMMENT ON COLUMN public.cita_confirmaciones.paciente_id IS
  'Paciente al que se emitió el enlace. SIN FK a propósito: una FK RESTRICT impediría borrar pacientes sin historial y SET NULL/CASCADE no se permiten. Exactamente uno de paciente_id / reserva_correo_hmac. Si el paciente de la cita cambia o se borra, el enlace deja de coincidir y deja de valer.';
COMMENT ON COLUMN public.cita_confirmaciones.respuesta IS
  'confirmo | cancelo: la ÚLTIMA respuesta del paciente por este enlace (respondido_en, su hora). Un confirmo seguido de un cancelo deja cancelo; el historial va en audit_log.';

-- ---------------------------------------------------------------------
-- 3 · cita_reagendos: reagendados por el paciente con su enlace.
-- ---------------------------------------------------------------------
CREATE TABLE public.cita_reagendos (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  cita_origen_id  uuid        NOT NULL,
  cita_nueva_id   uuid        NOT NULL,
  confirmacion_id uuid        NOT NULL,
  numero          smallint    NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_reagendos_pkey PRIMARY KEY (id),
  -- Una cita se reagenda UNA vez; una cita nueva viene de UNA.
  CONSTRAINT cita_reagendos_origen_key UNIQUE (cita_origen_id),
  CONSTRAINT cita_reagendos_nueva_key UNIQUE (cita_nueva_id),
  CONSTRAINT cita_reagendos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_origen_fkey FOREIGN KEY (cita_origen_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_nueva_fkey FOREIGN KEY (cita_nueva_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_confirmacion_fkey FOREIGN KEY (confirmacion_id) REFERENCES public.cita_confirmaciones(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_numero_check CHECK (numero BETWEEN 1 AND 100),
  CONSTRAINT cita_reagendos_distintas_check CHECK (cita_origen_id <> cita_nueva_id)
);

-- Para la FK RESTRICT a cita_confirmaciones.
CREATE INDEX cita_reagendos_confirmacion ON public.cita_reagendos (confirmacion_id);

ALTER TABLE public.cita_reagendos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cita_reagendos FROM PUBLIC, anon, authenticated, service_role;
-- Sin confirmacion_id. Nunca se borra ni se corrige: service_role sólo lee e inserta.
GRANT SELECT (id, clinica_id, cita_origen_id, cita_nueva_id, numero, created_at) ON TABLE public.cita_reagendos TO authenticated;
GRANT SELECT, INSERT ON TABLE public.cita_reagendos TO service_role;

-- Sin recursión (lee appointments). Se ve si se ve la cita NUEVA.
CREATE POLICY cita_reagendos_select ON public.cita_reagendos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_reagendos.cita_nueva_id AND a.clinica_id = public.get_clinica_id()));

COMMENT ON TABLE public.cita_reagendos IS
  'Reagendados por enlace (agenda E6): cita cancelada por el paciente con su enlace de confirmación → cita reservada con el enlace fijo del mismo médico. numero = reserva_reagendados de la nueva; tope agenda_ajustes.candado_reagendados. Sólo escribe reagendar_por_enlace; nunca se borra.';

-- ---------------------------------------------------------------------
-- 4 · cita_correos: un renglón por (cita, tipo, inicio_cita).
-- ---------------------------------------------------------------------
-- NO SE GUARDA DESTINATARIO NI CONTENIDO. Una tabla y no marcas en
-- appointments: una columna nueva allí se auditaría como cita_editada en cada
-- envío (c_tecnicas de log_cita_change es lista de exclusión).
-- Idempotencia en tres capas: (1) la UNIQUE de la llave + ON CONFLICT con
-- condición; (2) testigo + tomado_en (una ejecución muerta suelta el envío a
-- los 10 min; sólo quien lo tomó lo cierra); (3) Resend con Idempotency-Key
-- '<tipo>/<id>'. Máximo 3 intentos; fallido/duplicado no se reintenta.
CREATE TABLE public.cita_correos (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id     uuid        NOT NULL,
  appointment_id uuid        NOT NULL,
  tipo           text        NOT NULL,
  inicio_cita    timestamptz NOT NULL,
  estado         text        NOT NULL,
  intentos       smallint    NOT NULL DEFAULT 1,
  testigo        uuid,
  tomado_en      timestamptz,
  enviado_en     timestamptz,
  motivo         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_correos_pkey PRIMARY KEY (id),
  CONSTRAINT cita_correos_llave_key UNIQUE (appointment_id, tipo, inicio_cita),
  CONSTRAINT cita_correos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_correos_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  -- IS NOT NULL explícito en cada CHECK: un CHECK que evalúa a NULL pasa.
  CONSTRAINT cita_correos_tipo_check CHECK (tipo IS NOT NULL AND tipo IN ('comprobante', 'recordatorio', 'confirmacion')),
  CONSTRAINT cita_correos_estado_check CHECK (estado IS NOT NULL AND estado IN ('enviando', 'enviado', 'fallido', 'omitido')),
  CONSTRAINT cita_correos_intentos_check CHECK (intentos IS NOT NULL AND intentos BETWEEN 1 AND 3),
  CONSTRAINT cita_correos_motivo_check CHECK (motivo IS NULL OR motivo IN ('transporte', 'duplicado', 'sin_enlace', 'sin_destinatario', 'plantilla')),
  CONSTRAINT cita_correos_coherencia_check CHECK (
       (estado = 'enviando' AND testigo IS NOT NULL AND tomado_en IS NOT NULL AND motivo IS NULL AND enviado_en IS NULL)
    OR (estado = 'enviado' AND enviado_en IS NOT NULL AND motivo IS NULL)
    OR (estado IN ('fallido', 'omitido') AND motivo IS NOT NULL AND enviado_en IS NULL))
);

-- Para la FK RESTRICT a clinicas (la de appointments la cubre la llave).
CREATE INDEX cita_correos_clinica ON public.cita_correos (clinica_id);

ALTER TABLE public.cita_correos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cita_correos FROM PUBLIC, anon, authenticated, service_role;
-- Sin testigo, tomado_en, intentos, motivo ni marcas internas.
GRANT SELECT (id, clinica_id, appointment_id, tipo, inicio_cita, estado, enviado_en)
  ON TABLE public.cita_correos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cita_correos TO service_role;

-- Sin recursión (lee appointments).
CREATE POLICY cita_correos_select ON public.cita_correos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_correos.appointment_id AND a.clinica_id = public.get_clinica_id()));

COMMENT ON TABLE public.cita_correos IS
  'Envíos de correo de cita (agenda E4 y G3): recordatorio, comprobante y confirmacion (el correo de confirmación que el personal manda desde la agenda, con o sin Google). Llave (cita, tipo, inicio_cita): mover la cita da un recordatorio y una confirmación nuevos; una sola confirmación por inicio (salvo fallo, hasta 3 intentos). SIN destinatario ni contenido. Sólo escriben cita_correo_tomar y cita_correo_marcar. CONVENIO (dimensión 16): la expresión del destinatario está en cita_recordatorios_pendientes y en cita_correo_tomar (van juntas); el correo se compone determinista de la fila porque Resend exige el mismo cuerpo con la misma Idempotency-Key (<tipo>/<id>). fallido/duplicado no se reintenta; máximo 3 intentos. Un comprobante enviado, o enviando hace menos de 10 min, impide el recordatorio del mismo inicio; una confirmación, no. La ventana de agenda_ajustes.recordatorio_horas (y el margen de 1 h) sólo se exige al recordatorio; comprobante y confirmacion valen para cualquier cita futura.';
COMMENT ON COLUMN public.cita_correos.inicio_cita IS
  'start_time de la cita cuando se tomó el envío. Si la cita se mueve, la hora nueva es otra llave y tiene su propio recordatorio.';
COMMENT ON COLUMN public.cita_correos.testigo IS
  'uuid de la ejecución que tomó el envío (estado enviando). Sólo ella lo cierra; a los 10 min otra puede volver a tomarlo.';

-- ---------------------------------------------------------------------
-- 5 · avisos_clinica: lo que pasó en la agenda sin que nadie de la clínica
--     lo hiciera. Sólo lo escriben los disparadores aviso_clinica_de_*.
-- ---------------------------------------------------------------------
-- SIN FK a appointments a propósito (como reserva_empalmes_google): la
-- semilla, las e2e y la limpieza borran citas como postgres y una FK RESTRICT
-- bloquearía esos borrados; el lector cruza con appointments (RLS incluida).
-- revisado_por SIN FK: una FK a profiles bloquearía dar de baja a quien
-- revisó, y SET NULL dispararía el normalizador; es atribución, como
-- audit_log.user_id.
CREATE TABLE public.avisos_clinica (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id    uuid        NOT NULL,
  tipo          text        NOT NULL,
  cita_id       uuid        NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  revisado_en   timestamptz,
  revisado_por  uuid,
  CONSTRAINT avisos_clinica_pkey PRIMARY KEY (id),
  CONSTRAINT avisos_clinica_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  -- ⚠️ La misma lista que TIPOS_AVISO (src/lib/avisos/avisosClinica.ts). Un
  -- tipo nuevo va aquí antes que en el código: leerAvisosClinica pide sólo
  -- los tipos que conoce y salta fila a fila el que no.
  CONSTRAINT avisos_clinica_tipo_check CHECK (tipo IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
                                                       'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado',
                                                       'confirmacion_paciente')),
  CONSTRAINT avisos_clinica_revisado_check CHECK (revisado_por IS NULL OR revisado_en IS NOT NULL)
);

-- Un solo aviso SIN REVISAR por tipo y cita: los escritores usan ON CONFLICT
-- con ESTE predicado (si cambia, cambian los seis).
CREATE UNIQUE INDEX avisos_clinica_pendiente_key ON public.avisos_clinica (tipo, cita_id)
  WHERE revisado_en IS NULL;
-- La lectura de la campana: los sin revisar de una clínica, los más nuevos primero.
CREATE INDEX avisos_clinica_pendientes_idx ON public.avisos_clinica (clinica_id, creado_en DESC)
  WHERE revisado_en IS NULL;
-- La FK RESTRICT a clinicas (borrar una clínica busca aquí).
CREATE INDEX avisos_clinica_clinica_idx ON public.avisos_clinica (clinica_id);

ALTER TABLE public.avisos_clinica ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.avisos_clinica FROM PUBLIC, anon, authenticated, service_role;
-- El personal sólo marca revisado. Nadie más que el dueño (postgres) inserta
-- o borra; service_role nada (el servidor lee con la sesión).
GRANT SELECT ON TABLE public.avisos_clinica TO authenticated;
GRANT UPDATE (revisado_en, revisado_por) ON TABLE public.avisos_clinica TO authenticated;

-- Sin recursión: lee appointments, no avisos_clinica; el EXISTS corre bajo la
-- RLS de appointments de quien pregunta (el invitado, sólo las suyas).
CREATE POLICY avisos_clinica_select ON public.avisos_clinica FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()));
-- Un revisado no se reabre (USING revisado_en IS NULL + aviso_clinica_revisar).
CREATE POLICY avisos_clinica_update ON public.avisos_clinica FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id() AND revisado_en IS NULL
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()))
  WITH CHECK (clinica_id = public.get_clinica_id() AND revisado_por = auth.uid());

COMMENT ON TABLE public.avisos_clinica IS
  'Tanda I (punto 19): lo que pasó en la agenda sin que nadie de la clínica lo hiciera (reserva por enlace, cancelación y reagendado del paciente, evento de Google por asignar, empalme con Google). Se conserva hasta que alguien del personal lo revisa (revisado_en/revisado_por) y después queda como registro. Sólo la escriben los disparadores aviso_clinica_de_* (dueño postgres); el personal sólo marca revisado. Sin FK a appointments a propósito (como reserva_empalmes_google): el lector cruza con appointments.';

-- ---------------------------------------------------------------------
-- 6 · Funciones de la confirmación. Todas INVOKER; las que leen o escriben
--     datos, SÓLO service_role (BYPASSRLS): son la lectura y la escritura de
--     la página pública y del servidor sin sesión. Reciben p_clinica_id
--     OBLIGATORIO y lo casan con la fila en cada sentencia, salvo contexto,
--     que resuelve la clínica por el hash (es el único que no la conoce).
-- ---------------------------------------------------------------------
-- ¿El enlace sigue siendo de quien es hoy el destinatario de la cita? Pura.
CREATE FUNCTION public.cita_confirmacion_coincide(p_enlace_paciente uuid, p_enlace_hmac text, p_cita_paciente uuid, p_cita_hmac text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce((p_enlace_paciente IS NOT NULL AND p_enlace_paciente = p_cita_paciente)
               OR (p_enlace_hmac IS NOT NULL AND p_enlace_hmac = p_cita_hmac), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_coincide(uuid, text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_coincide(uuid, text, uuid, text) TO anon, authenticated, service_role;

-- Emitir (o devolver el vigente que coincide, con su hash, para que el
-- servidor compruebe que el código que deriva sigue siendo el guardado: tras
-- rotar RESERVA_SECRETO no lo es, revoca y emite otro). UNA fila siempre;
-- r_id NULL = no aplica. Candado 1791 por cita.
CREATE FUNCTION public.cita_confirmacion_emitir(p_clinica_id uuid, p_cita_id uuid, p_id uuid, p_codigo_hash text, p_creado_por uuid)
 RETURNS TABLE(r_id uuid, r_codigo_hash text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_a record;
  v_c public.cita_confirmaciones%ROWTYPE;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_id IS NULL OR p_codigo_hash IS NULL
     OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'cita_confirmacion_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id)
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN NEXT; RETURN;
  END IF;
  -- Serializa las emisiones de ESTA cita sin bloquear su fila en appointments.
  PERFORM pg_advisory_xact_lock(1791, hashtext(p_cita_id::text));
  SELECT a.id, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day AND a.start_time > now()
     AND (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL);
  IF NOT FOUND OR (v_a.paciente_id IS NULL AND v_a.reserva_correo_hmac IS NULL) THEN
    RETURN NEXT; RETURN;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.appointment_id = p_cita_id AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL;
  IF FOUND THEN
    IF public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
      r_id := v_c.id; r_codigo_hash := v_c.codigo_hash;
      RETURN NEXT; RETURN;
    END IF;
    UPDATE public.cita_confirmaciones SET revocado_en = now() WHERE id = v_c.id AND clinica_id = p_clinica_id;
  END IF;
  INSERT INTO public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id, reserva_correo_hmac, creado_por)
  VALUES (p_id, p_clinica_id, p_cita_id, p_codigo_hash, v_a.paciente_id,
          CASE WHEN v_a.paciente_id IS NULL THEN v_a.reserva_correo_hmac END,
          (SELECT p.id FROM public.profiles p WHERE p.id = p_creado_por AND p.clinica_id = p_clinica_id));
  r_id := p_id; r_codigo_hash := p_codigo_hash;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid) TO service_role;

-- Revocar el vigente (tras rotar el secreto; al reagendar). Nunca borra.
-- El mismo candado 1791 que emitir.
CREATE FUNCTION public.cita_confirmacion_revocar(p_clinica_id uuid, p_cita_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL THEN
    RAISE EXCEPTION 'cita_confirmacion_revocar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- El mismo candado que emitir: una revocación y una emisión de la MISMA cita
  -- no se intercalan (emitir no devuelve un vigente que se está revocando).
  PERFORM pg_advisory_xact_lock(1791, hashtext(p_cita_id::text));
  UPDATE public.cita_confirmaciones SET revocado_en = now()
   WHERE appointment_id = p_cita_id AND clinica_id = p_clinica_id AND revocado_en IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_revocar(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_revocar(uuid, uuid) TO service_role;

-- Lo que enseña /confirmar/{código}: STABLE, SÓLO LEE. Abrir el enlace o su
-- vista previa en un correo o en WhatsApp no cambia nada. NULL = 404
-- indistinguible (también con la clínica suspendida o la v2 apagada). NUNCA
-- título, notas, paciente, tipo de cita, especialidad ni ids de la cita.
CREATE FUNCTION public.cita_confirmacion_contexto(p_codigo_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_c      public.cita_confirmaciones%ROWTYPE;
  v_a      record;
  v_estado text;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c WHERE c.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_c.revocado_en IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.agenda_v2_encendida(v_c.clinica_id) THEN
    RETURN NULL;
  END IF;
  -- Clínica suspendida = no disponible (auditoría de E1, hallazgo 1). Es
  -- clinica_no_suspendida() con la clínica del enlace en vez de get_clinica_id().
  IF NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = v_c.clinica_id AND NOT k.suspendida) THEN
    RETURN NULL;
  END IF;
  SELECT a.id, a.status, a.start_time, a.end_time, a.medico_id, a.paciente_id, a.reserva_correo_hmac,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono, a.consultorio_timezone
    INTO v_a
    FROM public.appointments a
   WHERE a.id = v_c.appointment_id AND a.clinica_id = v_c.clinica_id;
  IF NOT FOUND OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac,
                                                        v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    RETURN NULL;
  END IF;
  v_estado := CASE
    WHEN v_a.status IN ('attended', 'no_show') THEN 'cerrada'
    WHEN v_a.status = 'cancelled'              THEN 'cancelada'
    WHEN v_a.start_time <= now()               THEN 'pasada'
    WHEN v_a.status = 'confirmed'              THEN 'confirmada'
    ELSE 'agendada' END;
  RETURN jsonb_build_object(
    'clinica_id', v_c.clinica_id,
    'estado', v_estado,
    'inicio', v_a.start_time,
    'fin', v_a.end_time,
    'zona', v_a.consultorio_timezone,
    'medico', (SELECT jsonb_build_object('titulo', p.titulo, 'nombres', p.nombres,
                                         'apellido_paterno', p.apellido_paterno, 'apellido_materno', p.apellido_materno)
                 FROM public.profiles p WHERE p.id = v_a.medico_id AND p.clinica_id = v_c.clinica_id),
    'consultorio', jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                                      'telefono', v_a.consultorio_telefono),
    'puede_confirmar', v_estado = 'agendada',
    'puede_cancelar', v_estado IN ('agendada', 'confirmada') AND v_a.start_time - interval '1 hour' > now(),
    'corte_cancelar', v_a.start_time - interval '1 hour',
    'respuesta', v_c.respuesta);
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_contexto(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_contexto(text) TO service_role;

-- La respuesta: lo ÚNICO que cambia el estado, y sólo desde el POST de un
-- botón. FOR UPDATE sobre el enlace y sobre la cita (en ese orden, el mismo
-- que reagendar_por_enlace: sin ciclo), y la hora con clock_timestamp()
-- DESPUÉS de los candados: now() sería la del inicio de la transacción y,
-- tras una espera, quedaría del lado equivocado de T-1h. Plazo FIJO de
-- cancelar: hasta 1 hora antes, estricto (PLAZO_CANCELAR de los correos lo
-- refleja). Nunca reactiva ni toca attended/no_show. Pone spinus.via =
-- 'enlace_paciente' antes de cada UPDATE de la cita; su UPDATE de respuesta
-- dispara los avisos cancelacion_paciente y confirmacion_paciente.
CREATE FUNCTION public.cita_confirmacion_responder(p_clinica_id uuid, p_codigo_hash text, p_accion text)
 RETURNS TABLE(r_resultado text, r_cita_id uuid, r_google_event_id text, r_gcal_etag text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_c     public.cita_confirmaciones%ROWTYPE;
  v_a     record;
  v_ahora timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$'
     OR p_accion IS NULL OR p_accion NOT IN ('confirmar', 'cancelar') THEN
    RAISE EXCEPTION 'cita_confirmacion_responder: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_codigo_hash AND c.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_c.revocado_en IS NOT NULL
     OR NOT public.agenda_v2_encendida(p_clinica_id)
     -- Suspendida = no disponible, como en contexto (auditoría de E1, hallazgo 1).
     OR NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_resultado := 'invalido'; RETURN NEXT; RETURN;
  END IF;
  -- La cita, bloqueada: lo de abajo decide sobre la fila VIGENTE.
  SELECT a.id, a.status, a.start_time, a.updated_at, a.paciente_id, a.reserva_correo_hmac, a.google_event_id, a.gcal_etag
    INTO v_a
    FROM public.appointments a
   WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac,
                                                        v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_resultado := 'invalido'; RETURN NEXT; RETURN;
  END IF;
  r_cita_id := v_a.id;
  -- Hora REAL tras los candados (ver cabecera). No usar now() aquí.
  v_ahora := clock_timestamp();
  IF v_a.status IN ('attended', 'no_show') THEN r_resultado := 'cerrada';      RETURN NEXT; RETURN; END IF;
  IF v_a.status = 'cancelled'              THEN r_resultado := 'ya_cancelada'; RETURN NEXT; RETURN; END IF;
  IF v_a.start_time <= v_ahora             THEN r_resultado := 'pasada';       RETURN NEXT; RETURN; END IF;

  IF p_accion = 'confirmar' THEN
    IF v_a.status = 'confirmed' THEN r_resultado := 'ya_confirmada'; RETURN NEXT; RETURN; END IF;
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments
       SET status = 'confirmed', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
     WHERE id = v_a.id AND clinica_id = p_clinica_id;
    UPDATE public.cita_confirmaciones SET respuesta = 'confirmo', respondido_en = v_ahora
     WHERE id = v_c.id AND clinica_id = p_clinica_id;
    r_resultado := 'confirmada';
  ELSE
    -- §2: hasta 1 hora antes. A T-1h exacto ya no.
    IF v_a.start_time - interval '1 hour' <= v_ahora THEN
      r_resultado := 'fuera_de_plazo'; RETURN NEXT; RETURN;
    END IF;
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments
       SET status = 'cancelled', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
     WHERE id = v_a.id AND clinica_id = p_clinica_id;
    UPDATE public.cita_confirmaciones SET respuesta = 'cancelo', respondido_en = v_ahora
     WHERE id = v_c.id AND clinica_id = p_clinica_id;
    r_resultado := 'cancelada';
  END IF;
  r_google_event_id := v_a.google_event_id;
  r_gcal_etag := v_a.gcal_etag;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_confirmacion_responder(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_confirmacion_responder(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------
-- 7 · Reagendar.
-- ---------------------------------------------------------------------
-- La oferta (STABLE, nunca escribe): lo que la página de confirmación
-- pregunta por GET.
CREATE FUNCTION public.cita_reagendar_oferta(p_clinica_id uuid, p_codigo_hash text)
 RETURNS TABLE(r_enlace_id uuid, r_motivo text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_tope integer;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  -- Suspendida = no disponible (el cierre de E1).
  IF NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_codigo_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF v_c.id IS NULL OR v_tope IS NULL OR v_c.respuesta IS DISTINCT FROM 'cancelo' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cita_reagendos r WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id) THEN
    r_motivo := 'ya_reagendada'; RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN r_motivo := 'vencida'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_motivo := 'tope'; RETURN NEXT; RETURN; END IF;
  SELECT e.id INTO r_enlace_id FROM public.reserva_enlaces e
   WHERE e.clinica_id = p_clinica_id AND e.medico_id = v_a.medico_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL;
  r_motivo := CASE WHEN r_enlace_id IS NULL THEN 'sin_enlace' ELSE 'ok' END;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) TO service_role;
COMMENT ON FUNCTION public.cita_reagendar_oferta(uuid, text) IS
  'Agenda E6: ¿se ofrece reagendar la cita de este enlace de confirmación? STABLE, sólo service_role. Clínica suspendida, apagada o sin respuesta cancelo: no_aplica.';

-- Reagendar por el paciente: valida el enlace de confirmación y la cita de
-- origen y llama a reservar_por_enlace (F3) en la MISMA transacción (con su
-- verificación del correo, su candado 1790 y «1 activa» intactos). Orden de
-- candados: cita_confirmaciones → cita de origen → reserva_enlaces (dentro de
-- reservar_por_enlace) → 1790; nadie toma cita_confirmaciones después de
-- reserva_enlaces. Pone spinus.via = 'enlace_paciente' sólo alrededor del
-- UPDATE de reserva_reagendados y lo vacía después.
CREATE FUNCTION public.reagendar_por_enlace(p_confirmacion_hash text, p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamp with time zone, p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text, p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
 RETURNS TABLE(r_resultado text, r_cita_id uuid, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_historial integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_e    record;
  v_tope integer;
  v_prev record;
  v_r    record;
BEGIN
  IF p_confirmacion_hash IS NULL OR p_confirmacion_hash !~ '^[0-9a-f]{64}$' OR p_clinica_id IS NULL
     OR p_codigo_hash IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_por_enlace: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_confirmacion_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_c.respuesta IS DISTINCT FROM 'cancelo'
     -- Suspendida = no disponible (el cierre de E1).
     OR NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- La cita de origen, bloqueada: el personal no la reactiva mientras tanto.
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- Idempotencia: el mismo envío ya reagendó; otro envío, ya está reagendada.
  SELECT r.cita_nueva_id, n.start_time, n.end_time, n.client_id INTO v_prev
    FROM public.cita_reagendos r JOIN public.appointments n ON n.id = r.cita_nueva_id AND n.clinica_id = p_clinica_id
   WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id;
  IF FOUND THEN
    IF v_prev.client_id = p_client_id::text THEN
      r_resultado := 'repetida'; r_cita_id := v_prev.cita_nueva_id; r_inicio := v_prev.start_time; r_fin := v_prev.end_time;
    ELSE
      r_resultado := 'ya_reagendada';
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT e.medico_id, e.clase INTO v_e FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL;
  IF NOT FOUND OR v_e.clase <> 'fijo' OR v_e.medico_id <> v_a.medico_id THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN r_resultado := 'apagado'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_resultado := 'tope_reagendados'; RETURN NEXT; RETURN; END IF;

  SELECT x.* INTO v_r FROM public.reservar_por_enlace(
    p_clinica_id, p_codigo_hash, p_consultorio_id, p_tipo_cita_id, p_inicio, p_nombre, p_telefono, p_correo,
    p_tel_hmac, p_correo_hmac, p_ficha_hmac, p_aviso_version, p_aviso_sha256, p_client_id) x;
  IF v_r.r_resultado = 'repetida' THEN
    -- D3 reconoció un envío que NO es el reagendado de este origen (ése lo
    -- atrapa la idempotencia de arriba): no se da por reagendado.
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  IF v_r.r_resultado = 'ok' THEN
    -- Lo hizo la persona por el enlace de su cita (lista blanca de E1).
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments SET reserva_reagendados = v_a.reserva_reagendados + 1
     WHERE id = v_r.r_cita_id AND clinica_id = p_clinica_id;
    INSERT INTO public.cita_reagendos (clinica_id, cita_origen_id, cita_nueva_id, confirmacion_id, numero)
    VALUES (p_clinica_id, v_a.id, v_r.r_cita_id, v_c.id, v_a.reserva_reagendados + 1);
    -- set_config(…, true) dura hasta el fin de la TRANSACCIÓN, no de la función:
    -- se limpia para que nada de lo que siga en ella herede el «via».
    PERFORM set_config('spinus.via', '', true);
  END IF;
  r_resultado := v_r.r_resultado; r_cita_id := v_r.r_cita_id; r_inicio := v_r.r_inicio;
  r_fin := v_r.r_fin; r_historial := v_r.r_historial;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;
COMMENT ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Agenda E6: valida el enlace de confirmación y la cita de origen y llama a reservar_por_enlace (D3) en la misma transacción; con ok, reserva_reagendados = origen + 1 (via enlace_paciente) y anota cita_reagendos. Sólo service_role.';

-- Reagendar por la clínica, para una cita reservada por enlace (la única vía
-- que deja pasar el candado de elección, cita_proteger_eleccion de F5b, por
-- el GUC spinus.reagendar_cita). Nunca cambia el médico.
CREATE FUNCTION public.cita_reagendar_clinica(p_clinica_id uuid, p_actor uuid, p_cita_id uuid, p_consultorio_id uuid, p_inicio timestamp with time zone, p_fin timestamp with time zone, p_esperado timestamp with time zone)
 RETURNS TABLE(r_resultado text, r_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_rol   record;
  v_a     record;
  v_con   record;
  v_campos text[];
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_cita_id IS NULL OR p_consultorio_id IS NULL
     OR p_inicio IS NULL OR p_fin IS NULL OR p_fin <= p_inicio THEN
    RAISE EXCEPTION 'cita_reagendar_clinica: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT public.agenda_v2_encendida(p_clinica_id) THEN
    r_resultado := 'apagado'; RETURN NEXT; RETURN;
  END IF;
  SELECT p.role, p.es_admin_de_clinica INTO v_rol FROM public.profiles p
   WHERE p.id = p_actor AND p.clinica_id = p_clinica_id;
  IF NOT FOUND THEN
    r_resultado := 'sin_permiso'; RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.medico_id, a.consultorio_id, a.start_time, a.end_time, a.status, a.all_day, a.reserva_canal, a.updated_at
    INTO v_a FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_a.reserva_canal IS NULL THEN
    r_resultado := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  -- La regla de appointments_update, con el actor en vez de auth.uid().
  IF NOT (v_a.medico_id = p_actor OR (v_rol.role = 'medico' AND v_rol.es_admin_de_clinica IS TRUE) OR v_rol.role = 'secretaria') THEN
    r_resultado := 'sin_permiso'; RETURN NEXT; RETURN;
  END IF;
  IF v_a.status NOT IN ('scheduled', 'confirmed') OR v_a.all_day THEN
    r_resultado := 'estado_no_admite'; RETURN NEXT; RETURN;
  END IF;
  IF v_a.start_time <= now() THEN
    r_resultado := 'pasada'; RETURN NEXT; RETURN;
  END IF;
  IF p_esperado IS NOT NULL AND v_a.updated_at IS DISTINCT FROM p_esperado THEN
    r_resultado := 'modificada'; RETURN NEXT; RETURN;
  END IF;
  IF p_inicio <= now() THEN
    r_resultado := 'hora_pasada'; RETURN NEXT; RETURN;
  END IF;
  SELECT c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone INTO v_con
    FROM public.consultorios c
   WHERE c.id = p_consultorio_id AND c.clinica_id = p_clinica_id AND c.medico_id = v_a.medico_id AND c.activo;
  IF NOT FOUND THEN
    r_resultado := 'consultorio_invalido'; RETURN NEXT; RETURN;
  END IF;
  v_campos := array_remove(ARRAY[
    CASE WHEN p_consultorio_id IS DISTINCT FROM v_a.consultorio_id THEN 'consultorio_id' END,
    CASE WHEN p_inicio IS DISTINCT FROM v_a.start_time THEN 'start_time' END,
    CASE WHEN p_fin IS DISTINCT FROM v_a.end_time THEN 'end_time' END], NULL);
  IF cardinality(v_campos) = 0 THEN
    r_resultado := 'sin_cambio'; r_updated_at := v_a.updated_at; RETURN NEXT; RETURN;
  END IF;

  -- La vía que el disparador reconoce: sólo para ESTA cita y sólo este UPDATE.
  PERFORM set_config('spinus.reagendar_cita', p_cita_id::text, true);
  UPDATE public.appointments
     SET consultorio_id = v_con.id, consultorio_nombre = v_con.nombre, consultorio_nombre_corto = v_con.nombre_corto,
         consultorio_direccion = v_con.direccion, consultorio_telefono = v_con.telefono, consultorio_timezone = v_con.timezone,
         start_time = p_inicio, end_time = p_fin, updated_at = now()
   WHERE id = p_cita_id AND clinica_id = p_clinica_id
  RETURNING updated_at INTO r_updated_at;
  -- set_config(…, true) dura hasta el fin de la TRANSACCIÓN (E6): se vacía ya.
  PERFORM set_config('spinus.reagendar_cita', '', true);

  -- Además de cita_editada ('system') de log_cita_change: quién reagendó y qué campos. Nunca valores.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (p_actor::text, 'cita_reagendada_clinica', 'appointments', p_cita_id,
          jsonb_build_object('clinica_id', p_clinica_id, 'campos', to_jsonb(v_campos))::text);

  r_resultado := 'ok'; RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) TO service_role;
COMMENT ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) IS
  'Agenda (tanda I, punto 9): «Reagendar» de la clínica para una cita reservada por enlace. Sólo service_role (POST /api/appointments/[id]/reagendar, que después avisa al paciente). Repite la regla de appointments_update con p_actor (de p_clinica_id: médico de la cita, médico administrador o secretaria). Cita por enlace, agendada o confirmada, sin empezar y sin todo el día; hora nueva futura; consultorio activo del MISMO médico (nunca cambia el médico); p_esperado = updated_at que vio la pantalla (NULL = sin comprobar). Escribe consultorio con su instantánea, inicio, fin y updated_at con el GUC spinus.reagendar_cita (lo reconoce cita_proteger_eleccion) y lo vacía. Audita cita_reagendada_clinica a nombre del actor con los nombres de los campos. Resultados: ok, sin_cambio, apagado, sin_permiso, no_aplica, estado_no_admite, pasada, modificada, hora_pasada, consultorio_invalido.';

-- ---------------------------------------------------------------------
-- 8 · Correos de cita.
-- ---------------------------------------------------------------------
-- ⚠️ DESTINATARIO: la MISMA expresión en cita_correo_tomar y en
-- cita_recordatorios_pendientes (van juntas): con paciente activo, su email y
-- si no tiene, reserva_correo; por ligar, reserva_correo; nada más. Nunca un
-- evento sin paciente ni de todo el día. Puertas: interruptor y S3, en el
-- listado (para que las clínicas sin acceso no ocupen el tope) y otra vez en
-- la toma, por clínica. Candado 1792 por cita en la toma.
CREATE FUNCTION public.cita_correo_tomar(p_clinica_id uuid, p_cita_id uuid, p_tipo text, p_testigo uuid)
 RETURNS TABLE(r_envio_id uuid, r_para text, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_zona text, r_estado text, r_medico jsonb, r_consultorio jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_a     record;
  v_horas integer;
  v_id    uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_testigo IS NULL
     OR p_tipo IS NULL OR p_tipo NOT IN ('comprobante', 'recordatorio', 'confirmacion') THEN
    RAISE EXCEPTION 'cita_correo_tomar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT j.recordatorio_horas INTO v_horas FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN;
  END IF;
  -- Serializa las tomas de ESTA cita (dos tipos o dos ejecuciones a la vez).
  PERFORM pg_advisory_xact_lock(1792, hashtext(p_cita_id::text));
  SELECT a.id, a.start_time, a.end_time, a.status, a.medico_id, a.consultorio_timezone,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono,
         -- ⚠️ Destinatario: la MISMA expresión que cita_recordatorios_pendientes.
         CASE WHEN a.paciente_id IS NOT NULL
              THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
              ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END AS para
    INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
     AND a.start_time > now() + CASE WHEN p_tipo = 'recordatorio' THEN interval '1 hour' ELSE interval '0' END
     AND (p_tipo <> 'recordatorio' OR a.start_time <= now() + make_interval(hours => v_horas));
  IF NOT FOUND OR v_a.para IS NULL THEN
    RETURN;
  END IF;
  IF p_tipo = 'recordatorio' AND EXISTS (
       SELECT 1 FROM public.cita_correos k
        WHERE k.appointment_id = p_cita_id AND k.clinica_id = p_clinica_id AND k.tipo = 'comprobante'
          AND k.inicio_cita = v_a.start_time
          AND (k.estado = 'enviado'
            OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes'))) THEN
    RETURN;
  END IF;
  INSERT INTO public.cita_correos AS k (clinica_id, appointment_id, tipo, inicio_cita, estado, intentos, testigo, tomado_en)
  VALUES (p_clinica_id, p_cita_id, p_tipo, v_a.start_time, 'enviando', 1, p_testigo, now())
  ON CONFLICT (appointment_id, tipo, inicio_cita) DO UPDATE
     SET estado = 'enviando', intentos = k.intentos + 1, testigo = p_testigo, tomado_en = now(),
         motivo = NULL, updated_at = now()
   WHERE k.clinica_id = p_clinica_id
     AND k.intentos < 3
     AND ((k.estado = 'fallido' AND k.motivo IS DISTINCT FROM 'duplicado')
       OR (k.estado = 'enviando' AND k.tomado_en <= now() - interval '10 minutes'))
  RETURNING k.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT v_id, v_a.para, v_a.start_time, v_a.end_time, v_a.consultorio_timezone, v_a.status,
    (SELECT jsonb_build_object('titulo', pr.titulo, 'nombres', pr.nombres, 'apellido_paterno', pr.apellido_paterno,
                               'apellido_materno', pr.apellido_materno)
       FROM public.profiles pr WHERE pr.id = v_a.medico_id AND pr.clinica_id = p_clinica_id),
    jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                       'telefono', v_a.consultorio_telefono);
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) TO service_role;

-- Cierra un envío; sólo lo cierra el testigo que lo tomó.
CREATE FUNCTION public.cita_correo_marcar(p_clinica_id uuid, p_envio_id uuid, p_testigo uuid, p_estado text, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_envio_id IS NULL OR p_testigo IS NULL
     OR p_estado IS NULL OR p_estado NOT IN ('enviado', 'fallido', 'omitido')
     OR (p_estado = 'enviado' AND p_motivo IS NOT NULL) OR (p_estado <> 'enviado' AND p_motivo IS NULL)
     OR (p_motivo IS NOT NULL AND p_motivo NOT IN ('transporte', 'duplicado', 'sin_enlace', 'sin_destinatario', 'plantilla')) THEN
    RAISE EXCEPTION 'cita_correo_marcar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.cita_correos
     SET estado = p_estado, motivo = p_motivo, updated_at = now(),
         enviado_en = CASE WHEN p_estado = 'enviado' THEN now() END
   WHERE id = p_envio_id AND clinica_id = p_clinica_id AND testigo = p_testigo AND estado = 'enviando';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_correo_marcar(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correo_marcar(uuid, uuid, uuid, text, text) TO service_role;

-- La ÚNICA lectura entre clínicas; devuelve sólo (clinica_id, cita_id). Mira
-- el interruptor recordatorio_encendido (apagado de fábrica): apagado, no
-- sale ningún recordatorio. Ventana (now()+1 h, now()+recordatorio_horas].
CREATE FUNCTION public.cita_recordatorios_pendientes(p_limite integer)
 RETURNS TABLE(r_clinica_id uuid, r_cita_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT x.clinica_id, x.id
    FROM public.agenda_ajustes j
   CROSS JOIN LATERAL (
     SELECT a.clinica_id, a.id, a.start_time
       FROM public.appointments a
       LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
      WHERE a.clinica_id = j.clinica_id
        AND a.start_time >  now() + interval '1 hour'
        AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
        AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
        -- ⚠️ Destinatario: la MISMA expresión que cita_correo_tomar.
        AND (CASE WHEN a.paciente_id IS NOT NULL
                  THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
                  ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.cita_correos k
                         WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                           AND ((k.tipo = 'comprobante'
                                 AND (k.estado = 'enviado'
                                   OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes')))
                             OR (k.tipo = 'recordatorio'
                                 AND (k.estado IN ('enviado', 'omitido')
                                   OR (k.estado = 'fallido' AND (k.intentos >= 3 OR k.motivo = 'duplicado'))
                                   OR (k.estado = 'enviando' AND (k.tomado_en > now() - interval '10 minutes' OR k.intentos >= 3))))))
      ORDER BY a.start_time
      LIMIT least(greatest(coalesce(p_limite, 0), 0), 500)
   ) x
   WHERE j.agenda_v2_encendida
     AND public.gcal_sync_clinica_habilitada(j.clinica_id)
     AND j.recordatorio_encendido
   ORDER BY x.start_time
   LIMIT least(greatest(coalesce(p_limite, 0), 0), 500);
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_recordatorios_pendientes(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_recordatorios_pendientes(integer) TO service_role;
COMMENT ON FUNCTION public.cita_recordatorios_pendientes(integer) IS
  'Listado ENTRE CLÍNICAS de recordatorios por mandar (sólo ids), para /api/cron/recordatorios. Sólo clínicas con la agenda v2 encendida, la puerta S3 (gcal_sync_clinica_habilitada) y el interruptor agenda_ajustes.recordatorio_encendido. CONVENIO: la expresión del destinatario va junta con la de cita_correo_tomar.';

-- El nombre del saludo del recordatorio (la tarea sin sesión sólo usa .rpc()).
-- SÓLO service_role: devuelve un dato de paciente por id de cita sin mirar
-- quién llama. Filtra p_clinica_id en la cita Y en el paciente.
CREATE FUNCTION public.cita_nombre_saludo(p_clinica_id uuid, p_cita_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(nullif(btrim(p.nombre), ''), nullif(btrim(a.reserva_nombre), ''))
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_nombre_saludo(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_nombre_saludo(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.cita_nombre_saludo(uuid, uuid) IS
  'Agenda v2 (integración M): el nombre del saludo del recordatorio. El paciente ligado y, si no, el de la reserva. Sólo service_role.';

-- ---------------------------------------------------------------------
-- 9 · Avisos. aviso_clinica_revisar es INVOKER (un revisado no se vuelve a
--     tocar; al revisar, revisado_en = now() del servidor). Los seis
--     escritores son SECURITY DEFINER de postgres y search_path vacío: sólo
--     insertan o reetiquetan en avisos_clinica con lo que trae la fila del
--     disparador, así no dependen de los permisos de quien llama
--     (service_role en las RPC). RETURNS trigger: no se pueden llamar por RPC.
--     EXECUTE a los tres roles, como toda función de disparador.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.aviso_clinica_revisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.revisado_en IS NOT NULL THEN
    NEW.revisado_en := OLD.revisado_en;
    NEW.revisado_por := OLD.revisado_por;
  ELSIF NEW.revisado_en IS NOT NULL THEN
    NEW.revisado_en := now();
  END IF;
  RETURN NEW;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_revisar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_revisar() TO anon, authenticated, service_role;

-- appointments AFTER INSERT: reserva_enlace (la cita la creó reservar_por_enlace)
-- o google_por_asignar (la marca que puso cita_asignacion_google en su BEFORE).
CREATE FUNCTION public.aviso_clinica_de_cita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, CASE WHEN NEW.reserva_enlace_id IS NOT NULL THEN 'reserva_enlace' ELSE 'google_por_asignar' END, NEW.id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_cita() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_cita() TO anon, authenticated, service_role;

-- cita_confirmaciones: el paciente canceló por su enlace.
CREATE FUNCTION public.aviso_clinica_de_respuesta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'cancelacion_paciente', NEW.appointment_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_respuesta() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_respuesta() TO anon, authenticated, service_role;

-- cita_confirmaciones: el paciente confirmó por su enlace. Cuelga de
-- cita_confirmaciones y NO de appointments: ahí no se distingue quién
-- confirmó (el personal y Google no escriben esta tabla).
CREATE FUNCTION public.aviso_clinica_de_confirmacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'confirmacion_paciente', NEW.appointment_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_confirmacion() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_confirmacion() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.aviso_clinica_de_confirmacion() IS
  'Tanda L (punto 13): deja el aviso confirmacion_paciente cuando el paciente confirma su cita por su enlace (cita_confirmacion_responder escribe respuesta = confirmo). Uno sin revisar por cita (índice de I5). La confirmación del personal no pasa por aquí.';

-- cita_reagendos AFTER INSERT: reetiqueta el reserva_enlace que acaba de dejar
-- la cita NUEVA en la misma transacción.
CREATE FUNCTION public.aviso_clinica_de_reagendo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.avisos_clinica SET tipo = 'reagendado_paciente'
   WHERE cita_id = NEW.cita_nueva_id AND clinica_id = NEW.clinica_id
     AND tipo = 'reserva_enlace' AND revisado_en IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
    VALUES (NEW.clinica_id, 'reagendado_paciente', NEW.cita_nueva_id)
    ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  END IF;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_reagendo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_reagendo() TO anon, authenticated, service_role;

-- reserva_empalmes_google (F2) AFTER INSERT.
CREATE FUNCTION public.aviso_clinica_de_empalme()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'empalme_google', NEW.cita_reserva_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_empalme() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_empalme() TO anon, authenticated, service_role;

-- gcal_movimientos_rechazados (F2) AFTER INSERT: uno por intento; si ya hay
-- uno sin revisar, le actualiza la hora.
CREATE FUNCTION public.aviso_clinica_de_movimiento_google()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'google_movimiento_rechazado', NEW.cita_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL
  DO UPDATE SET creado_en = now();
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_movimiento_google() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_movimiento_google() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10 · Disparadores.
-- ---------------------------------------------------------------------
CREATE TRIGGER audit_cita_confirmaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_confirmaciones
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER audit_cita_reagendos
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_reagendos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER audit_cita_correos
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_correos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER audit_avisos_clinica
  AFTER INSERT OR UPDATE OR DELETE ON public.avisos_clinica
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER trg_avisos_clinica_revisar
  BEFORE UPDATE ON public.avisos_clinica
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_revisar();
CREATE TRIGGER trg_appointments_aviso_clinica
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  -- ⚠️ 'por_asignar' es la marca de cita_asignacion_google (F2): la misma que
  -- cambioPuedeAvisar y esPorAsignar (src). Si cambia quién queda por
  -- asignar, cambian los tres. El WHEN ahorra la llamada en toda otra alta.
  WHEN (NEW.reserva_enlace_id IS NOT NULL OR NEW.google_asignacion = 'por_asignar')
  EXECUTE FUNCTION public.aviso_clinica_de_cita();
CREATE TRIGGER trg_cita_confirmaciones_aviso_clinica
  AFTER UPDATE OF respuesta ON public.cita_confirmaciones
  FOR EACH ROW
  WHEN (NEW.respuesta = 'cancelo' AND OLD.respuesta IS DISTINCT FROM 'cancelo')
  EXECUTE FUNCTION public.aviso_clinica_de_respuesta();
-- «Un aviso por confirmación»: mira la escritura de la respuesta (respuesta o
-- su hora), no la cita; un segundo POST o un eco de Google no escriben aquí.
CREATE TRIGGER trg_cita_confirmaciones_aviso_confirmacion
  AFTER UPDATE OF respuesta, respondido_en ON public.cita_confirmaciones
  FOR EACH ROW
  WHEN (NEW.respuesta = 'confirmo'
        AND (OLD.respuesta IS DISTINCT FROM 'confirmo' OR OLD.respondido_en IS DISTINCT FROM NEW.respondido_en))
  EXECUTE FUNCTION public.aviso_clinica_de_confirmacion();
CREATE TRIGGER trg_cita_reagendos_aviso_clinica
  AFTER INSERT ON public.cita_reagendos
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_reagendo();
CREATE TRIGGER trg_reserva_empalmes_aviso_clinica
  AFTER INSERT ON public.reserva_empalmes_google
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_empalme();
CREATE TRIGGER trg_gcal_movimientos_aviso_clinica
  AFTER INSERT ON public.gcal_movimientos_rechazados
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_movimiento_google();

-- ---------------------------------------------------------------------
-- 11 · Post-vuelo. Aborta (y deshace TODO) si algo no quedó como debe.
-- ---------------------------------------------------------------------
DO $post$
DECLARE
  v_mal text;
BEGIN
  -- Tablas: RLS, y privilegios de tabla exactos por rol (TRUNCATE incluido).
  SELECT string_agg(e.t || ' ' || e.r || '=' || coalesce(x.p, '') || ' (esperado ' || e.p || ')', '; ') INTO v_mal
    FROM (VALUES ('cita_confirmaciones', 'anon', ''), ('cita_confirmaciones', 'authenticated', ''),
                 ('cita_confirmaciones', 'service_role', 'INSERT,SELECT,UPDATE'),
                 ('cita_reagendos', 'anon', ''), ('cita_reagendos', 'authenticated', ''),
                 ('cita_reagendos', 'service_role', 'INSERT,SELECT'),
                 ('cita_correos', 'anon', ''), ('cita_correos', 'authenticated', ''),
                 ('cita_correos', 'service_role', 'INSERT,SELECT,UPDATE'),
                 ('avisos_clinica', 'anon', ''), ('avisos_clinica', 'authenticated', 'SELECT'),
                 ('avisos_clinica', 'service_role', ''), ('cita_confirmaciones', '-', ''), ('cita_reagendos', '-', ''),
                 ('cita_correos', '-', ''), ('avisos_clinica', '-', '')) AS e(t, r, p)
    LEFT JOIN LATERAL (
      SELECT string_agg(a.privilege_type, ',' ORDER BY a.privilege_type) AS p
        FROM pg_class c, aclexplode(c.relacl) a
       WHERE c.oid = to_regclass('public.' || e.t)
         AND a.grantee = CASE WHEN e.r = '-' THEN 0::oid ELSE (SELECT oid FROM pg_roles WHERE rolname = e.r) END) x ON true
   WHERE coalesce(x.p, '') <> e.p;
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: privilegios de tabla: %', v_mal;
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relrowsecurity AND oid IN (to_regclass('public.cita_confirmaciones'),
        to_regclass('public.cita_reagendos'), to_regclass('public.cita_correos'), to_regclass('public.avisos_clinica'))) <> 4 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: alguna tabla nueva sin RLS.';
  END IF;
  -- Columnas: sólo authenticated, y sólo éstas.
  SELECT string_agg(x, '; ') INTO v_mal FROM (
    SELECT table_name || ':' || grantee || ':' || privilege_type || ':'
           || string_agg(column_name, ',' ORDER BY column_name) AS x
      FROM information_schema.column_privileges
     WHERE table_schema = 'public' AND table_name IN ('cita_confirmaciones', 'cita_reagendos', 'cita_correos', 'avisos_clinica')
       AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
       AND NOT (grantee = 'service_role' AND table_name <> 'avisos_clinica')
       AND NOT (grantee = 'authenticated' AND table_name = 'avisos_clinica' AND privilege_type = 'SELECT')
     GROUP BY table_name, grantee, privilege_type) s
   WHERE x NOT IN ('avisos_clinica:authenticated:UPDATE:revisado_en,revisado_por',
                   'cita_confirmaciones:authenticated:SELECT:appointment_id,clinica_id,created_at,id,respondido_en,respuesta,revocado_en',
                   'cita_correos:authenticated:SELECT:appointment_id,clinica_id,enviado_en,estado,id,inicio_cita,tipo',
                   'cita_reagendos:authenticated:SELECT:cita_nueva_id,cita_origen_id,clinica_id,created_at,id,numero');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: privilegios de columna de más: %', v_mal;
  END IF;

  -- Funciones: dueño postgres, search_path vacío, ninguna con PUBLIC, DEFINER
  -- sólo los seis escritores, y EXECUTE exacto por rol.
  SELECT string_agg(p.proname, ', ') INTO v_mal
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
          OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                           'cita_recordatorios_pendientes', 'reagendar_por_enlace'))
     AND (pg_get_userbyid(p.proowner) <> 'postgres'
          OR NOT coalesce(p.proconfig @> ARRAY['search_path=""'], false)
          OR p.prosecdef IS DISTINCT FROM (p.proname LIKE 'aviso\_clinica\_de\_%')
          OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
          OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
          OR (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
             IS DISTINCT FROM (p.proname LIKE 'aviso\_clinica\_%' OR p.proname = 'cita_confirmacion_coincide')
          OR p.proname = 'cita_correos_pendientes');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: funciones con dueño, search_path, SECURITY o EXECUTE inesperados (o cita_correos_pendientes viva): %', v_mal;
  END IF;
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
        AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
             OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                              'cita_recordatorios_pendientes', 'reagendar_por_enlace'))) <> 19 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: no son 19 funciones de F4.';
  END IF;

  -- Disparadores: los 11, habilitados, con su función.
  SELECT string_agg(e.d, ', ') INTO v_mal
    FROM (VALUES ('appointments', 'trg_appointments_aviso_clinica', 'aviso_clinica_de_cita'),
                 ('cita_confirmaciones', 'audit_cita_confirmaciones', 'log_tabla_change'),
                 ('cita_confirmaciones', 'trg_cita_confirmaciones_aviso_clinica', 'aviso_clinica_de_respuesta'),
                 ('cita_confirmaciones', 'trg_cita_confirmaciones_aviso_confirmacion', 'aviso_clinica_de_confirmacion'),
                 ('cita_reagendos', 'audit_cita_reagendos', 'log_tabla_change'),
                 ('cita_reagendos', 'trg_cita_reagendos_aviso_clinica', 'aviso_clinica_de_reagendo'),
                 ('cita_correos', 'audit_cita_correos', 'log_tabla_change'),
                 ('avisos_clinica', 'audit_avisos_clinica', 'log_tabla_change'),
                 ('avisos_clinica', 'trg_avisos_clinica_revisar', 'aviso_clinica_revisar'),
                 ('reserva_empalmes_google', 'trg_reserva_empalmes_aviso_clinica', 'aviso_clinica_de_empalme'),
                 ('gcal_movimientos_rechazados', 'trg_gcal_movimientos_aviso_clinica', 'aviso_clinica_de_movimiento_google'))
         AS e(t, d, f)
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g JOIN pg_proc p ON p.oid = g.tgfoid
                      WHERE g.tgrelid = to_regclass('public.' || e.t) AND g.tgname = e.d
                        AND p.proname = e.f AND g.tgenabled = 'O');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: faltan disparadores (o están deshabilitados): %', v_mal;
  END IF;

  -- El índice que usan los ON CONFLICT de los seis escritores.
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid = to_regclass('public.avisos_clinica_pendiente_key')
                   AND i.indisunique AND pg_get_expr(i.indpred, i.indrelid) = '(revisado_en IS NULL)') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_clinica_pendiente_key no es el índice único parcial que esperan los escritores.';
  END IF;
  -- Las funciones de este archivo leen el interruptor con la de F1, y la
  -- tarea de recordatorios mira el suyo.
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('cita_confirmacion_contexto', 'cita_confirmacion_emitir', 'cita_confirmacion_responder', 'cita_reagendar_clinica')
        AND position('public.agenda_v2_encendida(' IN prosrc) > 0) <> 4
     OR position('j.recordatorio_encendido' IN (SELECT prosrc FROM pg_proc
                                                 WHERE oid = 'public.cita_recordatorios_pendientes(integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: los cuerpos no son los esperados (interruptor de F1 o recordatorio_encendido).';
  END IF;
END
$post$;

COMMIT;

-- ---------------------------------------------------------------------
-- 12 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tablas de F4 con RLS' AS comprobacion,
         (SELECT string_agg(relname, ',' ORDER BY relname) FROM pg_class
           WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
             AND relname IN ('avisos_clinica', 'cita_confirmaciones', 'cita_correos', 'cita_reagendos')) AS valor,
         'avisos_clinica,cita_confirmaciones,cita_correos,cita_reagendos' AS esperado
  UNION ALL
  SELECT 2, 'policies',
         (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('avisos_clinica', 'cita_confirmaciones', 'cita_correos', 'cita_reagendos')),
         'avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE,cita_confirmaciones_select:SELECT,cita_correos_select:SELECT,cita_reagendos_select:SELECT'
  UNION ALL
  SELECT 3, 'TRUNCATE de anon / authenticated / service_role sobre las 4 tablas',
         (SELECT count(*)::text FROM pg_class c, aclexplode(c.relacl) a
           WHERE c.oid IN (to_regclass('public.avisos_clinica'), to_regclass('public.cita_confirmaciones'),
                           to_regclass('public.cita_correos'), to_regclass('public.cita_reagendos'))
             AND a.privilege_type = 'TRUNCATE' AND a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role'))),
         '0'
  UNION ALL
  SELECT 4, 'funciones: total / DEFINER / con EXECUTE de PUBLIC / sin search_path',
         (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE p.prosecdef)::text || ' / '
                 || count(*) FILTER (WHERE EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text || ' / '
                 || count(*) FILTER (WHERE NOT coalesce(p.proconfig @> ARRAY['search_path=""'], false))::text
            FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
                  OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                                   'cita_recordatorios_pendientes', 'reagendar_por_enlace'))),
         '19 / 6 / 0 / 0'
  UNION ALL
  SELECT 5, 'funciones que ejecuta authenticated (sólo la pura y las de disparador)',
         (SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
                  OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                                   'cita_recordatorios_pendientes', 'reagendar_por_enlace'))),
         'aviso_clinica_de_cita,aviso_clinica_de_confirmacion,aviso_clinica_de_empalme,aviso_clinica_de_movimiento_google,aviso_clinica_de_reagendo,aviso_clinica_de_respuesta,aviso_clinica_revisar,cita_confirmacion_coincide'
  UNION ALL
  SELECT 6, 'disparadores de F4 (habilitados)',
         (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'
             AND tgname IN ('audit_avisos_clinica', 'audit_cita_confirmaciones', 'audit_cita_correos', 'audit_cita_reagendos',
                            'trg_appointments_aviso_clinica', 'trg_avisos_clinica_revisar', 'trg_cita_confirmaciones_aviso_clinica',
                            'trg_cita_confirmaciones_aviso_confirmacion', 'trg_cita_reagendos_aviso_clinica',
                            'trg_gcal_movimientos_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica')),
         '11'
  UNION ALL
  SELECT 7, 'tipos de aviso (= TIPOS_AVISO de src)',
         (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'avisos_clinica_tipo_check'
             AND conrelid = to_regclass('public.avisos_clinica')),
         'CHECK ((tipo = ANY (ARRAY[''reserva_enlace''::text, ''cancelacion_paciente''::text, ''reagendado_paciente''::text, ''google_por_asignar''::text, ''empalme_google''::text, ''google_movimiento_rechazado''::text, ''confirmacion_paciente''::text])))'
  UNION ALL
  SELECT 8, 'cita_correos_pendientes retirada',
         coalesce(to_regprocedure('public.cita_correos_pendientes(integer)')::text, 'ausente'),
         'ausente'
) t
ORDER BY t.n;
