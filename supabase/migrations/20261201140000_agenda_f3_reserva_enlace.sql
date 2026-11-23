-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F3 — reserva por enlace
-- Orden de aplicación: 3.º de 6 (F1 → F5a → F3 → F2 → F4 → F5b).
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE
--   Crea entero el bloque de la reserva por enlace, en su versión final:
--   · reserva_avisos (versiones aprobadas del aviso de la reserva);
--   · reserva_enlaces (fijo / único, con el correo, los intentos y el agotado
--     del único y la pausa del fijo);
--   · las 11 columnas appointments.reserva_* con sus 2 FK, 2 CHECK y 3 índices;
--   · reserva_verificaciones (código al correo del enlace fijo);
--   · el candado: reserva_incidencias (con su disparador AFTER en
--     appointments) y reserva_contactos (bloqueo y desbloqueo manuales);
--   · las funciones de la reserva y sus protecciones, con sus disparadores,
--     RLS, policies, permisos y comentarios.
--   No escribe datos.
--
-- DEPENDE DE
--   main: appointments (con client_id e idx_appointments_client_id, el índice
--     único cuyo nombre atrapa reservar_por_enlace), clinicas, profiles,
--     consultorios (con timezone), audit_log, ip_rate_limits,
--     get_clinica_id(), soy_admin_de_clinica(), get_my_role() (DEFINER: las
--     policies no recursan), log_tabla_change(); service_role con BYPASSRLS.
--   F1: agenda_ajustes (agenda_v2_encendida, candado_*, anticipacion_min_horas,
--     horizonte_dias, vigencia_enlace_unico_dias), tipos_cita (principal,
--     consultorio_id), appointments.tipo_cita_id/tipo_cita_nombre,
--     consultorios.horario/horario_propio y public.agenda_v2_encendida(uuid).
--   F5a: agenda_bloqueos (reserva_ocupacion es LANGUAGE sql y la nombra:
--     Postgres valida su cuerpo al crearla).
--   PostgreSQL ≥ 17: los GRANT de la sección 11 conceden MAINTAIN, que no
--   existe antes de la 17 (en una 15 o 16 el archivo falla y no deja nada).
--   El archivo va con fines de línea LF: el post-vuelo exige el md5 de un
--   cuerpo creado aquí (proteger_reserva_enlaces) y con CRLF no coincidiría
--   (aborta, no deja nada).
--   Lo comprueba el pre-vuelo (1) antes de crear nada.
--   F2 va DESPUÉS a propósito: su disparador cita_asignacion_google() lee
--   NEW.reserva_canal, que nace aquí; con F2 antes, entre los dos COMMIT
--   fallaría toda alta de cita. Las funciones de este bloque llaman a la
--   puerta de suscripción de F2, gcal_sync_clinica_habilitada(uuid), sólo
--   desde plpgsql, al ejecutarse: HASTA APLICAR F2 LA RESERVA POR ENLACE NO
--   FUNCIONA (42883). Nadie puede llamarla antes: no hay enlaces (los emite
--   sólo reserva_enlace_emitir, con service_role) ni la v2 encendida.
--
-- search_path: el resultado y las comprobaciones no dependen de él (todo va
--   calificado con public. o pg_catalog, y lo que el catálogo imprime según
--   el search_path —nombres de función de los disparadores, definiciones de
--   restricción— se compara ya calificado o sin el prefijo). Probado con
--   '', 'public' y el del rol postgres ("$user", public, extensions).
--
-- BLOQUEOS (lock_timeout 5 s, statement_timeout 60 s). Todo es UNA
--   transacción y cada candado dura hasta el COMMIT:
--   · appointments: SHARE ROW EXCLUSIVE desde el CREATE TABLE reserva_enlaces
--     (FK usado_cita_id) y ACCESS EXCLUSIVE desde el primer ALTER TABLE
--     (sección 4): primero no se puede escribir una cita y luego tampoco
--     leerla. ADD COLUMN no reescribe (un único DEFAULT, constante); las FK y
--     CHECK nuevas recorren la tabla una vez y los 3 índices la leen.
--   · clinicas y profiles: SHARE ROW EXCLUSIVE (FK de las tablas nuevas):
--     no se escriben mientras dura.
--   Medido en el clon de la foto: 67 ms en total con appointments vacía;
--   con 50 000 citas sintéticas, 297 ms en total y ~277 ms con ACCESS
--   EXCLUSIVE sobre appointments (de ellos ~213 ms el COMMIT).
--   No se baja con NOT VALID + VALIDATE: el ACCESS EXCLUSIVE del ADD COLUMN
--   ya dura hasta el COMMIT en la misma transacción, y partirla en varias
--   quitaría el «aborta sin dejar nada».
--   Riesgo real: si una consulta larga tiene appointments, el ALTER espera
--   hasta 5 s (lock_timeout) y, mientras espera, las consultas nuevas a
--   appointments esperan detrás; a los 5 s todo aborta sin dejar nada.
--   Aplicar con poco tráfico.
--
-- RIESGO: MEDIO. Es el único camino por el que alguien SIN sesión escribe una
--   cita (reservar_por_enlace, con service_role, que se salta la RLS); y deja
--   un disparador en appointments que, si fallara, haría fallar la
--   cancelación de una cita por enlace. Si el archivo falla en cualquier
--   punto, la transacción se deshace entera.
--
-- SEGUNDA PASADA: NO es re-ejecutable; ABORTA LIMPIO. Si ya existe cualquier
--   objeto de este bloque, el pre-vuelo lo dice («PRE-VUELO F3: … ya existe»)
--   y no toca nada (comprobado en el clon de la foto).
--
-- VUELTA ATRÁS: supabase/reversas/20261201140000_agenda_f3_reserva_enlace_reversa.sql
--   (con F5b, F4 y F2 ya quitados). Se niega si hay enlaces, avisos,
--   verificaciones, incidencias, contactos o citas por enlace, salvo
--   confirmación explícita (ver su cabecera): respaldar antes.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tabla text;
  v_faltan text[];
  c_mias CONSTANT text[] := ARRAY['proteger_reserva_contactos', 'proteger_reserva_enlace_unico',
    'proteger_reserva_enlaces', 'rate_limit_espera', 'reserva_codigo_emitir', 'reserva_codigo_verificar',
    'reserva_contacto_estado', 'reserva_contacto_marcar', 'reserva_contactos_bloqueados', 'reserva_contexto',
    'reserva_enlace_emitir', 'reserva_enlace_regenerar_fijo', 'reserva_espera_reenvio', 'reserva_ocupacion',
    'reserva_registrar_incidencia', 'reservar_por_enlace'];
BEGIN
  -- Este bloque no se re-aplica: si algo suyo existe, se para aquí.
  IF to_regclass('public.reserva_avisos') IS NOT NULL OR to_regclass('public.reserva_enlaces') IS NOT NULL
     OR to_regclass('public.reserva_verificaciones') IS NOT NULL OR to_regclass('public.reserva_incidencias') IS NOT NULL
     OR to_regclass('public.reserva_contactos') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                 AND attname LIKE 'reserva\_%' AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = ANY (c_mias))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                 AND tgname = 'trg_appointments_reserva_incidencia') THEN
    RAISE EXCEPTION 'PRE-VUELO F3: el bloque de la reserva por enlace ya existe (entero o en parte). Este archivo no se re-aplica; revisar a mano.';
  END IF;

  -- main
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.clinicas', 'public.profiles',
                                 'public.consultorios', 'public.audit_log', 'public.ip_rate_limits'] LOOP
    IF to_regclass(v_tabla) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO F3: falta % (main).', v_tabla;
    END IF;
  END LOOP;
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.clinicas', 'public.profiles'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO F3: el rol % no es dueño de % (columnas, FK y disparador).', current_user, v_tabla;
    END IF;
  END LOOP;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO F3: falta get_clinica_id(), soy_admin_de_clinica(), get_my_role() o log_tabla_change() (main).';
  END IF;
  -- Las policies de este bloque los llaman; si fueran INVOKER, leerían profiles con RLS y podrían recursar.
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO F3: un helper de las policies ya no es SECURITY DEFINER (recursión posible).';
  END IF;
  -- Todas las funciones de la reserva son INVOKER y sólo las llama service_role: sin BYPASSRLS no verían las filas.
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO F3: service_role no existe o ya no tiene BYPASSRLS.';
  END IF;
  SELECT array_agg(c) INTO v_faltan FROM unnest(ARRAY['client_id', 'clinica_id', 'medico_id', 'paciente_id', 'start_time',
      'end_time', 'status', 'all_day', 'origen', 'gcal_sync_status', 'consultorio_id', 'consultorio_nombre',
      'consultorio_nombre_corto', 'consultorio_direccion', 'consultorio_telefono', 'consultorio_timezone',
      'tipo_cita_id', 'tipo_cita_nombre']) c
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                      AND attname = c AND NOT attisdropped);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO F3: faltan columnas de appointments (main o F1): %.', v_faltan;
  END IF;
  -- reservar_por_enlace atrapa el unique_violation SÓLO de este índice por su nombre.
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid = to_regclass('public.idx_appointments_client_id')
                  AND i.indrelid = 'public.appointments'::regclass AND i.indisunique) THEN
    RAISE EXCEPTION 'PRE-VUELO F3: falta el índice único idx_appointments_client_id de appointments (main).';
  END IF;

  -- F1
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.tipos_cita') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO F3: falta agenda_ajustes o tipos_cita (¿F1 aplicado?).';
  END IF;
  SELECT array_agg(t || '.' || c) INTO v_faltan FROM (VALUES
      ('agenda_ajustes', 'agenda_v2_encendida'), ('agenda_ajustes', 'candado_cancelaciones'),
      ('agenda_ajustes', 'candado_ventana_dias'), ('agenda_ajustes', 'candado_citas_activas'),
      ('agenda_ajustes', 'anticipacion_min_horas'), ('agenda_ajustes', 'horizonte_dias'),
      ('agenda_ajustes', 'vigencia_enlace_unico_dias'),
      ('tipos_cita', 'principal'), ('tipos_cita', 'consultorio_id'), ('tipos_cita', 'duracion_min'),
      ('tipos_cita', 'activo'), ('consultorios', 'horario'), ('consultorios', 'horario_propio'),
      ('consultorios', 'timezone')) v(t, c)
   WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = ('public.' || t)::regclass
                      AND attname = c AND NOT attisdropped);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO F3: faltan columnas de F1: %.', v_faltan;
  END IF;
  IF to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL
     OR (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.agenda_v2_encendida(uuid)')) THEN
    RAISE EXCEPTION 'PRE-VUELO F3: falta public.agenda_v2_encendida(uuid) de F1, o es SECURITY DEFINER (tiene que ser INVOKER).';
  END IF;

  -- F5a
  IF to_regclass('public.agenda_bloqueos') IS NULL
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_bloqueos'::regclass AND NOT attisdropped
          AND attname IN ('clinica_id', 'medico_id', 'inicio', 'fin')) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO F3: falta agenda_bloqueos (clinica_id, medico_id, inicio, fin) de F5a.';
  END IF;

  -- F2 NO se exige: va después (ver la cabecera).
END $$;

-- ---------------------------------------------------------------------
-- 2 · reserva_avisos: versiones del aviso. Sólo el editor SQL escribe.
-- ---------------------------------------------------------------------
CREATE TABLE public.reserva_avisos (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  version      text        NOT NULL,
  texto_sha256 text        NOT NULL,
  aprobado     boolean     NOT NULL DEFAULT false,
  aprobado_en  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_avisos_pkey PRIMARY KEY (version),
  CONSTRAINT reserva_avisos_id_key UNIQUE (id),
  CONSTRAINT reserva_avisos_version_check CHECK (version ~ '^[a-z0-9][a-z0-9.-]{2,40}$'),
  CONSTRAINT reserva_avisos_sha_check CHECK (texto_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reserva_avisos_aprobado_check CHECK (aprobado = (aprobado_en IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- 3 · reserva_enlaces.
--     EL CÓDIGO NO SE GUARDA: el servidor lo deriva como
--     HMAC(RESERVA_SECRETO, 'enlace:' || id) y aquí sólo vive sha256(código)
--     en hex, que es por donde se busca. UNIQUE(codigo_hash) es global a
--     propósito: la búsqueda pública no conoce la clínica.
--     usado_cita_id tiene FK de una sola columna; que la cita sea de ESE
--     enlace y de ESA clínica lo exige proteger_reserva_enlaces (sin añadir un
--     UNIQUE(id, clinica_id) a appointments).
-- ---------------------------------------------------------------------
CREATE TABLE public.reserva_enlaces (
  id            uuid        NOT NULL,
  clinica_id    uuid        NOT NULL,
  medico_id     uuid        NOT NULL,
  clase         text        NOT NULL,
  codigo_hash   text        NOT NULL,
  etiqueta      text,
  vigencia_dias integer,
  caduca_en     timestamptz,
  usado_en      timestamptz,
  usado_cita_id uuid,
  revocado_en   timestamptz,
  revocado_por  uuid,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  correo        text,
  correo_hmac   text,
  intentos      integer     NOT NULL DEFAULT 0,
  agotado_en    timestamptz,
  pausado_en    timestamptz,
  CONSTRAINT reserva_enlaces_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_enlaces_id_clinica_key UNIQUE (id, clinica_id),
  CONSTRAINT reserva_enlaces_codigo_key UNIQUE (codigo_hash),
  CONSTRAINT reserva_enlaces_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_enlaces_medico_id_fkey  FOREIGN KEY (medico_id)  REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_enlaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_enlaces_revocado_por_fkey FOREIGN KEY (revocado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_enlaces_usado_cita_fkey FOREIGN KEY (usado_cita_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_enlaces_clase_check CHECK (clase IN ('fijo', 'unico')),
  CONSTRAINT reserva_enlaces_codigo_check CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reserva_enlaces_etiqueta_check CHECK (etiqueta IS NULL OR (btrim(etiqueta) <> '' AND char_length(etiqueta) <= 60)),
  CONSTRAINT reserva_enlaces_vigencia_check CHECK (
    (clase = 'unico' AND vigencia_dias IS NOT NULL AND vigencia_dias BETWEEN 1 AND 30 AND caduca_en IS NOT NULL)
    OR (clase = 'fijo' AND vigencia_dias IS NULL AND caduca_en IS NULL)),
  CONSTRAINT reserva_enlaces_uso_check CHECK (
    ((usado_en IS NULL) = (usado_cita_id IS NULL)) AND (usado_en IS NULL OR clase = 'unico')),
  CONSTRAINT reserva_enlaces_revocado_check CHECK (revocado_por IS NULL OR revocado_en IS NOT NULL),
  -- El correo del único: los dos juntos, sólo en el único, ya recortado.
  CONSTRAINT reserva_enlaces_correo_check CHECK (
    (correo IS NULL) = (correo_hmac IS NULL)
    AND (correo IS NULL OR (clase = 'unico' AND char_length(correo) BETWEEN 3 AND 254 AND position('@' IN correo) > 1
                            AND correo = btrim(correo) AND correo_hmac ~ '^[0-9a-f]{64}$'))),
  CONSTRAINT reserva_enlaces_intentos_check CHECK (intentos >= 0 AND (agotado_en IS NULL OR clase = 'unico')),
  CONSTRAINT reserva_enlaces_pausado_check CHECK (pausado_en IS NULL OR clase = 'fijo')
);

-- Un fijo vigente por médico. La pausa NO cuenta como revocado aquí: un fijo
-- pausado sigue siendo el vigente y vuelve con la misma dirección.
CREATE UNIQUE INDEX reserva_enlaces_fijo_vigente ON public.reserva_enlaces (clinica_id, medico_id)
  WHERE clase = 'fijo' AND revocado_en IS NULL;
CREATE INDEX reserva_enlaces_por_medico ON public.reserva_enlaces (clinica_id, medico_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 4 · appointments: las columnas de la reserva, FK compuesta (misma
--     clínica), FK al aviso, CHECK de coherencia e índices del candado.
--     Ninguna reserva_* lleva DEFAULT salvo reserva_reagendados (0):
--     cita_proteger_reserva (F5b) cierra todas por su prefijo, y un DEFAULT
--     en otra rompería el alta de citas con la sesión.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN reserva_enlace_id        uuid,
  ADD COLUMN reserva_canal            text,
  ADD COLUMN reserva_nombre           text,
  ADD COLUMN reserva_telefono         text,
  ADD COLUMN reserva_correo           text,
  ADD COLUMN reserva_tel_hmac         text,
  ADD COLUMN reserva_correo_hmac      text,
  ADD COLUMN reserva_aviso_version    text,
  ADD COLUMN reserva_aceptado_en      timestamptz,
  ADD COLUMN reserva_historial_previo smallint,
  ADD COLUMN reserva_reagendados      smallint NOT NULL DEFAULT 0;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_reserva_enlace_fkey
    FOREIGN KEY (reserva_enlace_id, clinica_id) REFERENCES public.reserva_enlaces (id, clinica_id) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_reserva_aviso_fkey
    FOREIGN KEY (reserva_aviso_version) REFERENCES public.reserva_avisos (version) ON DELETE RESTRICT,
  ADD CONSTRAINT appointments_reserva_check CHECK (
    (reserva_canal IS NULL AND reserva_enlace_id IS NULL AND reserva_nombre IS NULL AND reserva_telefono IS NULL
     AND reserva_correo IS NULL AND reserva_tel_hmac IS NULL AND reserva_correo_hmac IS NULL
     AND reserva_aviso_version IS NULL AND reserva_aceptado_en IS NULL AND reserva_historial_previo IS NULL)
    OR
    -- Cada columna con su IS NOT NULL explícito: un CHECK que evalúa a NULL
    -- PASA, y `NULL ~ '…'` o `btrim(NULL) <> ''` dan NULL. reserva_correo
    -- puede ir NULL (único sin correo, supresión ARCO); reserva_correo_hmac no
    -- (el único sin correo lleva su seudónimo, ver reservar_por_enlace).
    (reserva_canal IS NOT NULL AND reserva_canal IN ('fijo', 'unico') AND reserva_enlace_id IS NOT NULL
     AND reserva_nombre IS NOT NULL AND btrim(reserva_nombre) <> '' AND char_length(reserva_nombre) <= 120
     AND (reserva_telefono IS NULL OR reserva_telefono ~ '^[0-9]{10}$')
     AND (reserva_correo IS NULL OR char_length(reserva_correo) BETWEEN 3 AND 254)
     AND reserva_tel_hmac IS NOT NULL AND reserva_tel_hmac ~ '^[0-9a-f]{64}$'
     AND reserva_correo_hmac IS NOT NULL AND reserva_correo_hmac ~ '^[0-9a-f]{64}$'
     AND reserva_aviso_version IS NOT NULL AND reserva_aceptado_en IS NOT NULL
     AND reserva_historial_previo IS NOT NULL AND reserva_historial_previo >= 0)),
  ADD CONSTRAINT appointments_reserva_reagendados_check CHECK (reserva_reagendados BETWEEN 0 AND 100);

CREATE INDEX idx_appointments_reserva_enlace ON public.appointments (reserva_enlace_id)
  WHERE reserva_enlace_id IS NOT NULL;
CREATE INDEX idx_appointments_reserva_tel ON public.appointments (clinica_id, medico_id, reserva_tel_hmac)
  WHERE reserva_canal IS NOT NULL;
CREATE INDEX idx_appointments_reserva_correo ON public.appointments (clinica_id, medico_id, reserva_correo_hmac)
  WHERE reserva_canal IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5 · reserva_verificaciones: el código al correo del enlace fijo y la
--     ficha de un uso que deja al verificarse.
-- ---------------------------------------------------------------------
CREATE TABLE public.reserva_verificaciones (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  enlace_id       uuid        NOT NULL,
  correo_hmac     text        NOT NULL,
  codigo_hmac     text        NOT NULL,
  intentos        smallint    NOT NULL DEFAULT 0,
  caduca_en       timestamptz NOT NULL,
  verificado_en   timestamptz,
  ficha_hmac      text,
  ficha_caduca_en timestamptz,
  consumida_en    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_verificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_verificaciones_ficha_key UNIQUE (ficha_hmac),
  CONSTRAINT reserva_verificaciones_enlace_fkey FOREIGN KEY (enlace_id, clinica_id)
    REFERENCES public.reserva_enlaces (id, clinica_id) ON DELETE RESTRICT,
  CONSTRAINT reserva_verificaciones_intentos_check CHECK (intentos BETWEEN 0 AND 5),
  CONSTRAINT reserva_verificaciones_hmac_check CHECK (correo_hmac ~ '^[0-9a-f]{64}$' AND codigo_hmac ~ '^[0-9a-f]{64}$'
    AND (ficha_hmac IS NULL OR ficha_hmac ~ '^[0-9a-f]{64}$')),
  CONSTRAINT reserva_verificaciones_estado_check CHECK (
    ((verificado_en IS NULL) = (ficha_hmac IS NULL)) AND ((ficha_hmac IS NULL) = (ficha_caduca_en IS NULL))
    AND (consumida_en IS NULL OR verificado_en IS NOT NULL))
);
CREATE INDEX reserva_verificaciones_busqueda ON public.reserva_verificaciones
  (clinica_id, enlace_id, correo_hmac, created_at DESC);

-- ---------------------------------------------------------------------
-- 6 · El candado: incidencias (cancelación y no_show de citas por enlace)
--     y contactos (bloqueo y desbloqueo manuales, por médico).
-- ---------------------------------------------------------------------
CREATE TABLE public.reserva_incidencias (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id     uuid        NOT NULL,
  medico_id      uuid        NOT NULL,
  appointment_id uuid        NOT NULL,
  tipo           text        NOT NULL,
  tel_hmac       text        NOT NULL,
  correo_hmac    text        NOT NULL,
  anulada_en     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_incidencias_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_incidencias_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_medico_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_cita_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_incidencias_tipo_check CHECK (tipo IN ('cancelacion', 'no_show')),
  CONSTRAINT reserva_incidencias_hmac_check CHECK (tel_hmac ~ '^[0-9a-f]{64}$' AND correo_hmac ~ '^[0-9a-f]{64}$')
);
CREATE INDEX reserva_incidencias_tel ON public.reserva_incidencias (clinica_id, medico_id, tel_hmac, created_at)
  WHERE anulada_en IS NULL;
CREATE INDEX reserva_incidencias_correo ON public.reserva_incidencias (clinica_id, medico_id, correo_hmac, created_at)
  WHERE anulada_en IS NULL;
CREATE INDEX reserva_incidencias_cita ON public.reserva_incidencias (appointment_id);

CREATE TABLE public.reserva_contactos (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id    uuid        NOT NULL,
  medico_id     uuid        NOT NULL,
  clave_hmac    text        NOT NULL,
  clase         text        NOT NULL,
  bloqueado_en  timestamptz,
  bloqueado_por uuid,
  perdonado_en  timestamptz,
  perdonado_por uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_contactos_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_contactos_clave_key UNIQUE (clinica_id, medico_id, clave_hmac),
  CONSTRAINT reserva_contactos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_contactos_medico_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_contactos_bloqueado_por_fkey FOREIGN KEY (bloqueado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_contactos_perdonado_por_fkey FOREIGN KEY (perdonado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_contactos_clase_check CHECK (clase IN ('telefono', 'correo')),
  CONSTRAINT reserva_contactos_hmac_check CHECK (clave_hmac ~ '^[0-9a-f]{64}$')
);

-- ---------------------------------------------------------------------
-- 7 · Protecciones (disparadores BEFORE). INVOKER a propósito: deciden por
--     current_user, que en una DEFINER sería siempre el dueño.
-- ---------------------------------------------------------------------

-- QUIEN LA REEMPLACE PARTE DE ESTE CUERPO, byte a byte (md5 de prosrc
-- acd4128b5f25df54f6b4fd95391cf1dc, que CLAUDE.md cita y el post-vuelo
-- exige). Deja revocar a service_role (F1 la usa en «Restablecer»), no deja
-- reactivar, y no deja insertar a la sesión: la base no conoce
-- RESERVA_SECRETO, así que la única garantía de que el hash lo calculó el
-- servidor es que sólo el servidor inserte.
CREATE FUNCTION public.proteger_reserva_enlaces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Punto 7a: el código (y su hash) lo calcula el servidor con RESERVA_SECRETO; la base no puede comprobarlo.
    IF current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Los enlaces de reserva los emite el servidor' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
      RAISE EXCEPTION 'El médico del enlace no pertenece a la clínica' USING ERRCODE = '23514';
    END IF;
    NEW.created_at    := now();
    NEW.updated_at    := now();
    NEW.usado_en      := NULL;
    NEW.usado_cita_id := NULL;
    NEW.revocado_en   := NULL;
    NEW.revocado_por  := NULL;
    NEW.created_by    := coalesce(auth.uid(), NEW.created_by);
    IF NEW.clase = 'unico' THEN
      NEW.vigencia_dias := coalesce((SELECT j.vigencia_enlace_unico_dias FROM public.agenda_ajustes j
                                      WHERE j.clinica_id = NEW.clinica_id), 7);
      NEW.caduca_en := now() + make_interval(days => NEW.vigencia_dias);
    ELSE
      NEW.vigencia_dias := NULL;
      NEW.caduca_en     := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.clinica_id, NEW.medico_id, NEW.clase, NEW.codigo_hash, NEW.etiqueta, NEW.vigencia_dias,
      NEW.caduca_en, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.clinica_id, OLD.medico_id, OLD.clase, OLD.codigo_hash, OLD.etiqueta, OLD.vigencia_dias,
      OLD.caduca_en, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Un enlace emitido no se modifica: se revoca y se emite otro' USING ERRCODE = '42501';
  END IF;
  IF (NEW.revocado_en, NEW.revocado_por) IS DISTINCT FROM (OLD.revocado_en, OLD.revocado_por) THEN
    IF OLD.revocado_en IS NOT NULL OR NEW.revocado_en IS NULL THEN
      RAISE EXCEPTION 'Un enlace revocado no se reactiva' USING ERRCODE = '42501';
    END IF;
    NEW.revocado_en  := now();
    NEW.revocado_por := coalesce(auth.uid(), NEW.revocado_por);
  END IF;
  IF (NEW.usado_en, NEW.usado_cita_id) IS DISTINCT FROM (OLD.usado_en, OLD.usado_cita_id) THEN
    IF current_user <> 'service_role' OR OLD.usado_en IS NOT NULL OR NEW.usado_en IS NULL THEN
      RAISE EXCEPTION 'Sólo la reserva marca un enlace como usado, y una sola vez' USING ERRCODE = '42501';
    END IF;
    -- La cita que lo gasta es de ESTE enlace y de ESTA clínica (la FK de
    -- usado_cita_id es de una sola columna: esto la ata a la clínica sin
    -- añadir un UNIQUE(id, clinica_id) a appointments).
    IF NOT EXISTS (SELECT 1 FROM public.appointments a
                    WHERE a.id = NEW.usado_cita_id AND a.clinica_id = NEW.clinica_id
                      AND a.reserva_enlace_id = NEW.id) THEN
      RAISE EXCEPTION 'La cita que gasta el enlace no es de ese enlace' USING ERRCODE = '23514';
    END IF;
    NEW.usado_en := now();
  END IF;
  RETURN NEW;
END
$fn$;

-- Columnas del único: el correo no cambia una vez emitido, y los intentos
-- sólo los sube service_role (la RPC), nunca hacia abajo.
CREATE FUNCTION public.proteger_reserva_enlace_unico()
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
    -- Al emitir: sin intentos y sin agotar, lo pida quien lo pida.
    NEW.intentos   := 0;
    NEW.agotado_en := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.correo, NEW.correo_hmac) IS DISTINCT FROM (OLD.correo, OLD.correo_hmac) THEN
    RAISE EXCEPTION 'El correo de un enlace emitido no se modifica: se revoca y se emite otro' USING ERRCODE = '42501';
  END IF;
  IF (NEW.intentos, NEW.agotado_en) IS DISTINCT FROM (OLD.intentos, OLD.agotado_en) THEN
    IF current_user <> 'service_role' OR NEW.intentos < OLD.intentos
       OR (OLD.agotado_en IS NOT NULL AND NEW.agotado_en IS DISTINCT FROM OLD.agotado_en) THEN
      RAISE EXCEPTION 'Sólo la reserva cuenta los intentos de un enlace, y no los devuelve' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE FUNCTION public.proteger_reserva_contactos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- El médico es de la clínica de la fila, lo inserte quien lo inserte (la
    -- FK es de una sola columna a profiles). Mismo error exista o no el perfil
    -- ajeno: con la RLS de la sesión, uno de otra clínica ni se ve. Va antes
    -- que la FK (BEFORE), así que no hay oráculo de existencia.
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
      RAISE EXCEPTION 'El médico del contacto no pertenece a la clínica' USING ERRCODE = '23514';
    END IF;
    NEW.created_at    := now();
    NEW.updated_at    := now();
    NEW.bloqueado_por := CASE WHEN NEW.bloqueado_en IS NOT NULL THEN auth.uid() END;
    NEW.bloqueado_en  := CASE WHEN NEW.bloqueado_en IS NOT NULL THEN now() END;
    NEW.perdonado_por := CASE WHEN NEW.perdonado_en IS NOT NULL THEN auth.uid() END;
    NEW.perdonado_en  := CASE WHEN NEW.perdonado_en IS NOT NULL THEN now() END;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.clinica_id, NEW.medico_id, NEW.clave_hmac, NEW.clase, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.clinica_id, OLD.medico_id, OLD.clave_hmac, OLD.clase, OLD.created_at) THEN
    RAISE EXCEPTION 'La identidad de un contacto no cambia' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  IF NEW.bloqueado_en IS DISTINCT FROM OLD.bloqueado_en THEN
    IF NEW.bloqueado_en IS NULL THEN
      RAISE EXCEPTION 'Se desbloquea con perdonado_en, no borrando el bloqueo' USING ERRCODE = '42501';
    END IF;
    NEW.bloqueado_en := now(); NEW.bloqueado_por := auth.uid();
  ELSE
    NEW.bloqueado_por := OLD.bloqueado_por;
  END IF;
  IF NEW.perdonado_en IS DISTINCT FROM OLD.perdonado_en THEN
    IF NEW.perdonado_en IS NULL THEN
      RAISE EXCEPTION 'Un desbloqueo no se deshace: se vuelve a bloquear' USING ERRCODE = '42501';
    END IF;
    NEW.perdonado_en := now(); NEW.perdonado_por := auth.uid();
  ELSE
    NEW.perdonado_por := OLD.perdonado_por;
  END IF;
  RETURN NEW;
END
$fn$;

-- Disparador AFTER de appointments. DEFINER sólo para insertar en
-- reserva_incidencias (sin policy de INSERT); no escribe ninguna otra tabla.
-- RETURNS trigger: no es invocable por RPC. Supone que los dos *_hmac son de
-- datos reales: el servidor no seudonimiza vacíos, y el único sin correo
-- lleva un seudónimo propio de esa reserva (nunca compartido).
CREATE FUNCTION public.reserva_registrar_incidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  c_cuentan CONSTANT text[] := ARRAY['cancelled', 'no_show'];
BEGIN
  IF NEW.reserva_canal IS NULL OR NEW.medico_id IS NULL
     OR NEW.reserva_tel_hmac IS NULL OR NEW.reserva_correo_hmac IS NULL THEN
    RETURN NULL;
  END IF;
  IF NEW.status = ANY (c_cuentan) AND NOT (OLD.status = ANY (c_cuentan)) THEN
    INSERT INTO public.reserva_incidencias (clinica_id, medico_id, appointment_id, tipo, tel_hmac, correo_hmac)
    VALUES (NEW.clinica_id, NEW.medico_id, NEW.id,
            CASE NEW.status WHEN 'cancelled' THEN 'cancelacion' ELSE 'no_show' END,
            NEW.reserva_tel_hmac, NEW.reserva_correo_hmac);
  ELSIF OLD.status = ANY (c_cuentan) AND NOT (NEW.status = ANY (c_cuentan)) THEN
    UPDATE public.reserva_incidencias SET anulada_en = now()
     WHERE appointment_id = NEW.id AND clinica_id = NEW.clinica_id AND anulada_en IS NULL;
  ELSIF OLD.status = ANY (c_cuentan) AND NEW.status = ANY (c_cuentan) THEN
    UPDATE public.reserva_incidencias
       SET tipo = CASE NEW.status WHEN 'cancelled' THEN 'cancelacion' ELSE 'no_show' END
     WHERE appointment_id = NEW.id AND clinica_id = NEW.clinica_id AND anulada_en IS NULL;
  END IF;
  RETURN NULL;
END
$fn$;

CREATE TRIGGER trg_reserva_enlaces_proteger
  BEFORE INSERT OR UPDATE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_enlaces();
CREATE TRIGGER trg_reserva_enlaces_unico
  BEFORE INSERT OR UPDATE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_enlace_unico();
CREATE TRIGGER audit_reserva_enlaces
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER audit_reserva_avisos
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_avisos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE TRIGGER trg_reserva_contactos_proteger
  BEFORE INSERT OR UPDATE ON public.reserva_contactos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_contactos();
CREATE TRIGGER audit_reserva_contactos
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_contactos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
-- Reactivar una cita anula su incidencia; pasar de cancelled a no_show la
-- re-etiqueta (no cuenta doble). Lo escriba quien lo escriba: personal,
-- Google o la reserva.
CREATE TRIGGER trg_appointments_reserva_incidencia
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  WHEN (NEW.reserva_canal IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.reserva_registrar_incidencia();

-- ---------------------------------------------------------------------
-- 8 · El candado: estado de un contacto, bloquear/desbloquear y la lista
--     de bloqueados. INVOKER; las dos últimas, con la sesión.
-- ---------------------------------------------------------------------

-- El bloqueo AUTOMÁTICO decide sólo por el correo; el teléfono, sólo por el
-- bloqueo MANUAL. No vuelvas a contar incidencias por teléfono: nadie lo
-- verifica y dejaría perjudicar a un tercero escribiendo su número.
CREATE FUNCTION public.reserva_contacto_estado(p_clinica_id uuid, p_medico_id uuid, p_tel_hmac text, p_correo_hmac text)
RETURNS TABLE(bloqueado boolean, manual boolean, cancelaciones integer, no_shows integer, hasta timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  WITH aj AS (
    SELECT coalesce(max(j.candado_cancelaciones), 3) AS umbral,
           coalesce(max(j.candado_ventana_dias), 60) AS ventana
      FROM public.agenda_ajustes j
     WHERE j.clinica_id = p_clinica_id
  ),
  -- Manual: lo que la clínica bloqueó a mano, por teléfono o por correo.
  -- El desbloqueo que descuenta incidencias es el del CORREO.
  k AS (
    SELECT max(c.perdonado_en) FILTER (WHERE c.clave_hmac = p_correo_hmac) AS perdonado,
           coalesce(bool_or(c.bloqueado_en IS NOT NULL
                            AND (c.perdonado_en IS NULL OR c.perdonado_en < c.bloqueado_en)), false) AS manual
      FROM public.reserva_contactos c
     WHERE c.clinica_id = p_clinica_id AND c.medico_id = p_medico_id
       AND c.clave_hmac IN (p_tel_hmac, p_correo_hmac)
  ),
  -- Automático: cancelaciones e inasistencias SÓLO por el correo. El
  -- teléfono no lo es: nadie lo verifica y cualquiera puede escribir uno ajeno.
  i AS (
    SELECT x.tipo, x.created_at, row_number() OVER (ORDER BY x.created_at DESC) AS n
      FROM public.reserva_incidencias x CROSS JOIN aj CROSS JOIN k
     WHERE x.clinica_id = p_clinica_id AND x.medico_id = p_medico_id AND x.anulada_en IS NULL
       AND x.correo_hmac = p_correo_hmac
       AND x.created_at > now() - make_interval(days => aj.ventana)
       AND x.created_at > coalesce(k.perdonado, '-infinity'::timestamptz)
  )
  SELECT k.manual OR (SELECT count(*) FROM i) >= aj.umbral,
         k.manual,
         (SELECT count(*) FROM i WHERE i.tipo = 'cancelacion')::integer,
         (SELECT count(*) FROM i WHERE i.tipo = 'no_show')::integer,
         (SELECT i.created_at + make_interval(days => aj.ventana) FROM i WHERE i.n = aj.umbral)
    FROM aj CROSS JOIN k;
$fn$;

CREATE FUNCTION public.reserva_contacto_marcar(p_cita_id uuid, p_accion text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v       record;
  v_clave record;
  v_n     integer := 0;
BEGIN
  IF p_cita_id IS NULL OR p_accion IS NULL OR p_accion NOT IN ('bloquear', 'desbloquear') THEN
    RAISE EXCEPTION 'reserva_contacto_marcar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT a.clinica_id, a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac INTO v
    FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = public.get_clinica_id()
     AND a.reserva_canal IS NOT NULL AND a.medico_id IS NOT NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  FOR v_clave IN SELECT * FROM (VALUES (v.reserva_tel_hmac, 'telefono'), (v.reserva_correo_hmac, 'correo')) t(clave, clase) LOOP
    INSERT INTO public.reserva_contactos AS c (clinica_id, medico_id, clave_hmac, clase, bloqueado_en, perdonado_en)
    VALUES (v.clinica_id, v.medico_id, v_clave.clave, v_clave.clase,
            CASE WHEN p_accion = 'bloquear' THEN now() END,
            CASE WHEN p_accion = 'desbloquear' THEN now() END)
    ON CONFLICT (clinica_id, medico_id, clave_hmac) DO UPDATE
      SET bloqueado_en = CASE WHEN p_accion = 'bloquear' THEN now() ELSE c.bloqueado_en END,
          perdonado_en = CASE WHEN p_accion = 'desbloquear' THEN now() ELSE c.perdonado_en END;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END
$fn$;

-- La ventana mira la fecha de ALTA de la cita: + 366 días cubre una reserva
-- con el horizonte máximo (365) cancelada al final de la ventana del candado.
CREATE FUNCTION public.reserva_contactos_bloqueados()
RETURNS TABLE(cita_id uuid, medico_id uuid, nombre text, telefono text, correo text,
              manual boolean, cancelaciones integer, no_shows integer, hasta timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  WITH ventana AS (
    SELECT coalesce((SELECT j.candado_ventana_dias FROM public.agenda_ajustes j
                      WHERE j.clinica_id = public.get_clinica_id()), 60) + 366 AS dias
  )
  SELECT u.id, u.medico_id, u.reserva_nombre, u.reserva_telefono, u.reserva_correo,
         e.manual, e.cancelaciones, e.no_shows, e.hasta
    FROM (
      SELECT DISTINCT ON (a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac)
             a.id, a.clinica_id, a.medico_id, a.reserva_nombre, a.reserva_telefono, a.reserva_correo,
             a.reserva_tel_hmac, a.reserva_correo_hmac
        FROM public.appointments a CROSS JOIN ventana v
       WHERE a.clinica_id = public.get_clinica_id()
         AND a.reserva_canal IS NOT NULL AND a.medico_id IS NOT NULL
         AND a.created_at > now() - make_interval(days => v.dias)
       ORDER BY a.medico_id, a.reserva_tel_hmac, a.reserva_correo_hmac, a.created_at DESC
    ) u
   CROSS JOIN LATERAL public.reserva_contacto_estado(u.clinica_id, u.medico_id, u.reserva_tel_hmac, u.reserva_correo_hmac) e
   WHERE e.bloqueado
   ORDER BY u.reserva_nombre
   LIMIT 500;
$fn$;

-- ---------------------------------------------------------------------
-- 9 · Emisión de enlaces. Sólo service_role (POST /api/agenda/enlaces y
--     «Restablecer», con createAdminClient y la clínica de la sesión).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reserva_enlace_emitir(p_clinica_id uuid, p_actor uuid, p_id uuid, p_medico_id uuid,
                                             p_clase text, p_codigo_hash text, p_etiqueta text,
                                             p_correo text, p_correo_hmac text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_id IS NULL OR p_medico_id IS NULL OR p_codigo_hash IS NULL
     OR p_clase IS NULL OR p_clase NOT IN ('fijo', 'unico') OR (p_clase = 'fijo' AND p_etiqueta IS NOT NULL)
     -- El correo del único: los dos juntos; el fijo nunca lleva.
     OR (p_correo IS NULL) <> (p_correo_hmac IS NULL) OR (p_clase = 'fijo' AND p_correo IS NOT NULL) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- La regla de las policies de reserva_enlaces, con el actor en lugar de auth.uid().
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = p_actor AND p.clinica_id = p_clinica_id
                    AND (p.id = p_medico_id OR (p.role = 'medico' AND p.es_admin_de_clinica IS TRUE)
                         OR p.role = 'secretaria')) THEN
    RAISE EXCEPTION 'reserva_enlace_emitir: quien emite no gestiona los enlaces de ese médico' USING ERRCODE = '42501';
  END IF;
  IF p_clase = 'fijo' THEN
    UPDATE public.reserva_enlaces
       SET revocado_en = now(), revocado_por = p_actor
     WHERE clinica_id = p_clinica_id AND medico_id = p_medico_id AND clase = 'fijo' AND revocado_en IS NULL;
  END IF;
  INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, etiqueta, created_by, correo, correo_hmac)
  VALUES (p_id, p_clinica_id, p_medico_id, p_clase, p_codigo_hash, p_etiqueta, p_actor, btrim(p_correo), p_correo_hmac);
  RETURN p_id;
END
$fn$;

-- ---------------------------------------------------------------------
-- 10 · La reserva pública. Todas INVOKER y SÓLO service_role. Toda
--      escritura recibe p_clinica_id y lo vuelve a casar con el enlace;
--      reserva_contexto es la única que entra por el hash del código (la
--      clínica aún no se conoce). Un enlace PAUSADO es, hacia fuera,
--      idéntico a uno revocado: toda función que abra un enlace para el
--      público mira «revocado_en IS NULL AND pausado_en IS NULL».
-- ---------------------------------------------------------------------

-- NULL = 404 indistinguible (no existe, revocado, pausado, apagado, aviso no
-- aprobado, clínica sin acceso). Lee el interruptor junto con los ajustes, así
-- que no usa agenda_v2_encendida(). A la página NO viaja el correo del enlace.
CREATE FUNCTION public.reserva_contexto(p_codigo_hash text, p_aviso_version text, p_aviso_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_e  public.reserva_enlaces%ROWTYPE;
  v_p  record;
  v_aj record;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.* INTO v_e FROM public.reserva_enlaces e WHERE e.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_e.revocado_en IS NOT NULL OR v_e.pausado_en IS NOT NULL THEN RETURN NULL; END IF;
  SELECT j.anticipacion_min_horas, j.horizonte_dias INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = v_e.clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    RETURN NULL;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(v_e.clinica_id) THEN RETURN NULL; END IF;
  SELECT p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, p.especialidad, p.telefono_consultorio INTO v_p
    FROM public.profiles p WHERE p.id = v_e.medico_id AND p.clinica_id = v_e.clinica_id AND p.role = 'medico';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'clinica_id', v_e.clinica_id, 'enlace_id', v_e.id, 'medico_id', v_e.medico_id, 'clase', v_e.clase,
    'estado', CASE WHEN v_e.clase = 'unico' AND v_e.usado_en IS NOT NULL THEN 'usado'
                   WHEN v_e.clase = 'unico' AND v_e.caduca_en <= now() THEN 'caducado'
                   WHEN v_e.clase = 'unico' AND v_e.agotado_en IS NOT NULL THEN 'agotado' ELSE 'vigente' END,
    'medico', jsonb_build_object('titulo', v_p.titulo, 'nombres', v_p.nombres, 'apellido_paterno', v_p.apellido_paterno,
                                 'apellido_materno', v_p.apellido_materno, 'especialidad', v_p.especialidad,
                                 'telefono', v_p.telefono_consultorio),
    'clinica', (SELECT jsonb_build_object('nombre', c.nombre, 'nombre_display', c.nombre_display, 'horario', c.horario_consulta)
                  FROM public.clinicas c WHERE c.id = v_e.clinica_id),
    'consultorios', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion,
                       'telefono', c.telefono, 'timezone', c.timezone, 'horario', c.horario, 'horario_propio', c.horario_propio)
                       ORDER BY c.es_default DESC, c.nombre), '[]'::jsonb)
                       FROM public.consultorios c
                      WHERE c.clinica_id = v_e.clinica_id AND c.medico_id = v_e.medico_id AND c.activo),
    'tipos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'duracion_min', t.duracion_min,
                                                         'consultorio_id', t.consultorio_id, 'principal', t.principal)
                ORDER BY t.nombre), '[]'::jsonb)
                FROM public.tipos_cita t
               WHERE t.clinica_id = v_e.clinica_id AND t.activo AND (t.medico_id IS NULL OR t.medico_id = v_e.medico_id)),
    'ajustes', jsonb_build_object('anticipacion_min_horas', v_aj.anticipacion_min_horas, 'horizonte_dias', v_aj.horizonte_dias));
END
$fn$;

-- Sólo puntas (libre / ocupado), nunca qué hay. LANGUAGE sql: se valida al
-- crearse, por eso agenda_bloqueos (F5a) y agenda_v2_encendida (F1) van antes.
CREATE FUNCTION public.reserva_ocupacion(p_clinica_id uuid, p_enlace_id uuid, p_desde timestamptz, p_hasta timestamptz)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  -- Lo que tiene hora y no está cancelado ni faltó (lo de TODO EL DÍA no
  -- ocupa) y los bloqueos del médico. La misma condición de empalme que
  -- reservar_por_enlace.
  SELECT o.start_time, o.end_time
    FROM public.reserva_enlaces e
    CROSS JOIN LATERAL (
      SELECT a.start_time, a.end_time
        FROM public.appointments a
       WHERE a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
         AND a.start_time < p_hasta AND a.end_time > p_desde
         AND a.status NOT IN ('cancelled', 'no_show')
         AND NOT a.all_day
      UNION ALL
      SELECT b.inicio, b.fin
        FROM public.agenda_bloqueos b
       WHERE b.clinica_id = e.clinica_id AND b.medico_id = e.medico_id
         AND b.inicio < p_hasta AND b.fin > p_desde
    ) o
   WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.pausado_en IS NULL
     AND public.agenda_v2_encendida(e.clinica_id)
     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
   ORDER BY o.start_time;
$fn$;

-- El código al correo, sólo en el enlace fijo. Un código nuevo invalida los
-- anteriores del mismo enlace y correo.
CREATE FUNCTION public.reserva_codigo_emitir(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL
     OR p_correo_hmac !~ '^[0-9a-f]{64}$' OR p_codigo_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_enlaces e
                  WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL
                    AND public.agenda_v2_encendida(e.clinica_id))
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN 'enlace_invalido';
  END IF;
  UPDATE public.reserva_verificaciones SET intentos = 5
   WHERE clinica_id = p_clinica_id AND enlace_id = p_enlace_id AND correo_hmac = p_correo_hmac
     AND verificado_en IS NULL AND intentos < 5;
  -- clock_timestamp(): dos códigos pedidos en la misma transacción no empatan
  -- en created_at, que es por donde verificar elige el último.
  INSERT INTO public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
  VALUES (p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, now() + interval '10 minutes', clock_timestamp());
  RETURN 'ok';
END
$fn$;

CREATE FUNCTION public.reserva_codigo_verificar(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text,
                                                p_codigo_hmac text, p_ficha_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v public.reserva_verificaciones%ROWTYPE;
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL OR p_ficha_hmac IS NULL
     OR p_ficha_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_verificar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.* INTO v FROM public.reserva_verificaciones r
   WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
     AND r.verificado_en IS NULL
   ORDER BY r.created_at DESC, r.intentos ASC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'sin_codigo'; END IF;
  IF v.intentos >= 5 THEN RETURN 'agotado'; END IF;
  IF v.caduca_en <= now() THEN RETURN 'caducado'; END IF;
  IF v.codigo_hmac <> p_codigo_hmac THEN
    -- El código de un correo ANTERIOR (lo invalidó un reenvío) no cuenta como equivocado.
    IF EXISTS (SELECT 1 FROM public.reserva_verificaciones r
                WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
                  AND r.id <> v.id AND r.verificado_en IS NULL AND r.caduca_en > now()
                  AND r.codigo_hmac = p_codigo_hmac) THEN
      RETURN 'reemplazado';
    END IF;
    UPDATE public.reserva_verificaciones SET intentos = intentos + 1 WHERE id = v.id;
    RETURN CASE WHEN v.intentos + 1 >= 5 THEN 'agotado' ELSE 'incorrecto' END;
  END IF;
  UPDATE public.reserva_verificaciones
     SET verificado_en = now(), ficha_hmac = p_ficha_hmac, ficha_caduca_en = now() + interval '30 minutes'
   WHERE id = v.id;
  RETURN 'ok';
END
$fn$;

-- Los 30 s entre códigos son POR ENLACE: contarlos con la llave global del
-- correo filtraría actividad entre clínicas.
CREATE FUNCTION public.reserva_espera_reenvio(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_segundos integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_sale timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_segundos IS NULL OR p_segundos < 1 THEN
    RAISE EXCEPTION 'reserva_espera_reenvio: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.created_at + make_interval(secs => p_segundos) INTO v_sale
    FROM public.reserva_verificaciones r
   WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
   ORDER BY r.created_at DESC
   LIMIT 1;
  IF v_sale IS NULL OR v_sale <= now() THEN
    RETURN 0;
  END IF;
  -- `least`: created_at lo sella clock_timestamp() en otra transacción y puede ir por delante de now().
  RETURN least(p_segundos, greatest(1, ceil(extract(epoch FROM v_sale - now()))::integer));
END
$fn$;

-- Informa el Retry-After de los límites por red, navegador y enlace de las
-- rutas públicas. No escribe ni sustituye a rate_limit_intento (main).
CREATE FUNCTION public.rate_limit_espera(p_ruta text, p_limite integer, p_ventana_seg integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_sale timestamptz;
BEGIN
  IF p_ruta IS NULL OR p_limite IS NULL OR p_limite < 1 OR p_ventana_seg IS NULL OR p_ventana_seg < 1 THEN
    RAISE EXCEPTION 'rate_limit_espera: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.created_at + make_interval(secs => p_ventana_seg) INTO v_sale
    FROM public.ip_rate_limits r
   WHERE r.ruta = p_ruta AND r.created_at >= now() - make_interval(secs => p_ventana_seg)
   ORDER BY r.created_at DESC
  OFFSET p_limite - 1 LIMIT 1;
  -- `<` y no `<=`: rate_limit_intento cuenta `created_at >= now() - ventana`.
  IF v_sale IS NULL OR v_sale < now() THEN
    RETURN 0;
  END IF;
  RETURN greatest(1, ceil(extract(epoch FROM v_sale - now()))::integer);
END
$fn$;

-- La reserva. GARANTÍA DE UN SOLO TURNO: FOR UPDATE sobre la fila del enlace
-- + candado consultivo (1790, hashtext(medico_id)) por médico, que también
-- toman los bloqueos (agenda_bloqueo_preparar, gcal_bloqueo_aplicar); dentro
-- se vuelven a comprobar empalme y candado y se inserta. NO es una EXCLUDE:
-- el personal puede empalmar citas a propósito. La firma no cambia:
-- reagendar_por_enlace (F4) la llama y la ruta pública también.
CREATE FUNCTION public.reservar_por_enlace(
  p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamptz,
  p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text,
  p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
RETURNS TABLE(r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_enl   public.reserva_enlaces%ROWTYPE;
  v_aj    record;
  v_con   record;
  v_tipo  record;
  v_hist  record;
  v_verif uuid;
  v_fin   timestamptz;
  v_id    uuid;
  -- El correo que cuenta. En el ÚNICO, el que escribió la clínica al emitir
  -- el enlace (o ninguno); en el FIJO, el verificado.
  v_correo      text;
  v_correo_hmac text;
  -- Intentos que admite un enlace único (ver el contador, abajo).
  c_tope_unico CONSTANT integer := 5;
  v_restr      text;
BEGIN
  -- p_correo y p_correo_hmac son opcionales, pero LOS DOS JUNTOS.
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_consultorio_id IS NULL OR p_tipo_cita_id IS NULL
     OR p_inicio IS NULL OR p_nombre IS NULL OR p_telefono IS NULL OR p_tel_hmac IS NULL
     OR (p_correo IS NULL) <> (p_correo_hmac IS NULL)
     OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reservar_por_enlace: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_nombre) = '' OR char_length(p_nombre) > 120 OR p_telefono !~ '^[0-9]{10}$'
     OR (p_correo IS NOT NULL AND (char_length(p_correo) NOT BETWEEN 3 AND 254 OR position('@' IN p_correo) = 0))
     OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_tel_hmac !~ '^[0-9a-f]{64}$' OR p_correo_hmac !~ '^[0-9a-f]{64}$'
     OR (p_ficha_hmac IS NOT NULL AND p_ficha_hmac !~ '^[0-9a-f]{64}$')
     OR date_trunc('minute', p_inicio) <> p_inicio THEN
    RAISE EXCEPTION 'reservar_por_enlace: datos con forma inválida' USING ERRCODE = '22023';
  END IF;

  -- La garantía de un solo turno exige READ COMMITTED: cada sentencia después
  -- del candado toma una instantánea nueva y ve la reserva que ganó. En
  -- REPEATABLE READ o SERIALIZABLE la instantánea es la del inicio y el
  -- empalme no se vería. PostgREST usa READ COMMITTED; si alguien lo cambia,
  -- esto falla cerrado en vez de duplicar turnos.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'reservar_por_enlace: requiere READ COMMITTED (es %)', current_setting('transaction_isolation')
      USING ERRCODE = '25001';
  END IF;

  -- El enlace, bloqueado: dos reservas con el mismo enlace se serializan.
  SELECT e.* INTO v_enl FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_enl.revocado_en IS NOT NULL OR v_enl.pausado_en IS NOT NULL THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  -- Candado por médico (empalme y candado de persona en la misma sección).
  PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));

  -- Idempotencia: el mismo envío ya entró.
  SELECT a.id, a.start_time, a.end_time INTO v_id, r_inicio, r_fin FROM public.appointments a
   WHERE a.client_id = p_client_id::text AND a.clinica_id = p_clinica_id AND a.reserva_enlace_id = v_enl.id;
  IF FOUND THEN
    r_resultado := 'repetida'; r_cita_id := v_id; RETURN NEXT; RETURN;
  END IF;
  r_inicio := NULL; r_fin := NULL;

  IF v_enl.clase = 'unico' AND v_enl.usado_en IS NOT NULL THEN
    r_resultado := 'enlace_usado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'unico' AND v_enl.caduca_en <= now() THEN
    r_resultado := 'enlace_caducado'; RETURN NEXT; RETURN;
  END IF;

  -- El ÚNICO cuenta cada intento que llega aquí (un reenvío del mismo
  -- client_id ya salió arriba como 'repetida' y no cuenta). Agotado, no sirve
  -- más y no dice por qué. El intento número c_tope_unico es el último: lo
  -- marca agotado al empezar, y si reserva queda además usado. Bajo el FOR
  -- UPDATE del enlace: dos intentos a la vez se cuentan los dos.
  -- DESDE AQUÍ NADA PUEDE LANZAR una excepción que provoque quien reserva: la
  -- excepción desharía el conteo. Por eso lo que sigue son comprobaciones que
  -- devuelven un resultado, y el INSERT de la cita va en su propio bloque.
  -- El correo del único es el de la clínica (v_enl.correo), NUNCA p_correo.
  IF v_enl.clase = 'unico' THEN
    IF v_enl.agotado_en IS NOT NULL THEN
      r_resultado := 'enlace_agotado'; RETURN NEXT; RETURN;
    END IF;
    UPDATE public.reserva_enlaces
       SET intentos = intentos + 1,
           agotado_en = CASE WHEN intentos + 1 >= c_tope_unico THEN now() END
     WHERE id = v_enl.id AND clinica_id = p_clinica_id;
    v_correo := v_enl.correo;
    v_correo_hmac := v_enl.correo_hmac;
    -- Un client_id que ya usó OTRA cita haría fallar el INSERT de abajo
    -- (índice único) y la excepción desharía este conteo: con él se probarían
    -- teléfonos sin gastar el enlace. Se corta aquí, ANTES de mirar nada de la
    -- persona, y el intento queda contado.
    IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id = p_client_id::text) THEN
      r_resultado := 'client_id_en_uso'; RETURN NEXT; RETURN;
    END IF;
  ELSE
    v_correo := p_correo;
    v_correo_hmac := p_correo_hmac;
  END IF;

  -- El interruptor se lee junto con los ajustes: no usa agenda_v2_encendida().
  SELECT j.anticipacion_min_horas, j.horizonte_dias, j.candado_citas_activas INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN
    r_resultado := 'apagado'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    r_resultado := 'aviso_no_aprobado'; RETURN NEXT; RETURN;
  END IF;
  -- service_role no pasa por appointments_gates_insert: ésta es la puerta de suscripción.
  IF NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    r_resultado := 'clinica_sin_acceso'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = v_enl.medico_id AND p.clinica_id = p_clinica_id AND p.role = 'medico') THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  SELECT c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone INTO v_con
    FROM public.consultorios c
   WHERE c.id = p_consultorio_id AND c.clinica_id = p_clinica_id AND c.medico_id = v_enl.medico_id AND c.activo;
  IF NOT FOUND THEN
    r_resultado := 'consultorio_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- No mira el consultorio del tipo: qué tipos valen en cada consultorio lo
  -- decide el servidor antes de llamar (tiposDelConsultorio).
  SELECT t.id, t.nombre, t.duracion_min INTO v_tipo
    FROM public.tipos_cita t
   WHERE t.id = p_tipo_cita_id AND t.clinica_id = p_clinica_id AND t.activo
     AND (t.medico_id IS NULL OR t.medico_id = v_enl.medico_id);
  IF NOT FOUND THEN
    r_resultado := 'tipo_invalido'; RETURN NEXT; RETURN;
  END IF;
  v_fin := p_inicio + make_interval(mins => v_tipo.duracion_min);

  IF p_inicio < now() + make_interval(hours => v_aj.anticipacion_min_horas)
     OR p_inicio >= now() + make_interval(days => v_aj.horizonte_dias) THEN
    r_resultado := 'fuera_de_ventana'; RETURN NEXT; RETURN;
  END IF;

  -- Empalme (la misma condición que reserva_ocupacion): lo de TODO EL DÍA no
  -- ocupa en el enlace (un «Congreso» de todo el día no significa que no
  -- consulte); lo que tiene hora sí. Un bloqueo del médico (agenda_bloqueos)
  -- ocupa, sin excepción, con el mismo solape. Los dos son EXISTS: no lanzan.
  -- El bloqueo se escribe bajo el mismo candado 1790: uno confirmado antes de
  -- este candado se ve aquí (READ COMMITTED).
  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND a.status NOT IN ('cancelled', 'no_show')
                AND NOT a.all_day)
     OR EXISTS (SELECT 1 FROM public.agenda_bloqueos b
                 WHERE b.clinica_id = p_clinica_id AND b.medico_id = v_enl.medico_id
                   AND b.inicio < v_fin AND b.fin > p_inicio) THEN
    r_resultado := 'ocupado'; RETURN NEXT; RETURN;
  END IF;

  -- En el fijo, el correo verificado se exige ANTES de mirar nada de la
  -- persona (v_correo_hmac es p_correo_hmac en el fijo): sin ficha, la
  -- respuesta y el trabajo son los mismos para cualquier teléfono. Sin
  -- correo, el fijo no reserva (lo mismo que una ficha que no casa).
  IF v_enl.clase = 'fijo' THEN
    IF v_correo_hmac IS NULL THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
    SELECT r.id INTO v_verif FROM public.reserva_verificaciones r
     WHERE r.ficha_hmac = p_ficha_hmac AND r.clinica_id = p_clinica_id AND r.enlace_id = v_enl.id
       AND r.correo_hmac = v_correo_hmac AND r.verificado_en IS NOT NULL AND r.consumida_en IS NULL
       AND r.ficha_caduca_en > now()
     FOR UPDATE;
    IF NOT FOUND THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- Lo automático (cancelaciones e inasistencias, «1 activa») decide por el
  -- CORREO; el bloqueo MANUAL de la clínica, por teléfono o correo, y corta
  -- también el enlace único. Sin correo, v_correo_hmac es NULL y decide sólo
  -- el teléfono (el bloqueo manual). A PROPÓSITO: un «bloqueado» delata que la
  -- clínica bloqueó a mano ese teléfono.
  SELECT * INTO v_hist FROM public.reserva_contacto_estado(p_clinica_id, v_enl.medico_id, p_tel_hmac, v_correo_hmac);
  IF v_hist.manual OR (v_enl.clase = 'fijo' AND v_hist.bloqueado) THEN
    -- En el ÚNICO, «bloqueado» agota el enlace: es el intento que revela algo
    -- de la persona, así que un único deja probar UN teléfono, no uno tras
    -- otro. El que no está bloqueado reserva y gasta el enlace, así que de un
    -- único sale como mucho una respuesta.
    IF v_enl.clase = 'unico' THEN
      UPDATE public.reserva_enlaces SET agotado_en = coalesce(agotado_en, now())
       WHERE id = v_enl.id AND clinica_id = p_clinica_id;
    END IF;
    r_resultado := 'bloqueado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'fijo'
     AND (SELECT count(*) FROM public.appointments a
           WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id AND a.reserva_canal IS NOT NULL
             AND a.reserva_correo_hmac = v_correo_hmac
             AND a.status IN ('scheduled', 'confirmed') AND a.end_time > now()) >= v_aj.candado_citas_activas THEN
    r_resultado := 'ya_tiene_cita'; RETURN NEXT; RETURN;
  END IF;

  -- El id lo pone la función para que la reserva SIN correo lleve, en el
  -- mismo INSERT, su seudónimo propio: sha256('reserva-sin-correo:' || id) en
  -- hex. No es el HMAC de ningún correo y no sirve para buscar a la persona
  -- (para eso está el teléfono); sólo cumple appointments_reserva_check.
  v_id := gen_random_uuid();
  -- El INSERT va en su propio bloque. Si otra transacción que este candado no
  -- serializa (otro médico) confirma antes una cita con el mismo client_id, el
  -- índice único revienta aquí (el EXISTS de arriba no ve lo no confirmado);
  -- sin el bloque, la excepción desharía también el conteo del único. Sólo se
  -- atrapa ESE índice; lo demás sube. No lo «simplifiques» quitando el bloque.
  BEGIN
    INSERT INTO public.appointments (
      id, clinica_id, paciente_id, created_by, medico_id, title, start_time, end_time, status, origen, all_day, client_id,
      gcal_sync_status,
      consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono,
      consultorio_timezone, tipo_cita_id, tipo_cita_nombre,
      reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac,
      reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
    VALUES (
      v_id, p_clinica_id, NULL, NULL, v_enl.medico_id, btrim(p_nombre), p_inicio, v_fin, 'scheduled', 'spinus', false, p_client_id::text,
      'pending',
      v_con.id, v_con.nombre, v_con.nombre_corto, v_con.direccion, v_con.telefono, v_con.timezone, v_tipo.id, v_tipo.nombre,
      v_enl.id, v_enl.clase, btrim(p_nombre), p_telefono, btrim(v_correo), p_tel_hmac,
      coalesce(v_correo_hmac, encode(sha256(convert_to('reserva-sin-correo:' || v_id::text, 'UTF8')), 'hex')),
      p_aviso_version, now(), coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0));
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_restr = CONSTRAINT_NAME;
    IF v_restr IS DISTINCT FROM 'idx_appointments_client_id' THEN
      RAISE;
    END IF;
    r_resultado := 'client_id_en_uso'; RETURN NEXT; RETURN;
  END;

  IF v_enl.clase = 'unico' THEN
    UPDATE public.reserva_enlaces SET usado_en = now(), usado_cita_id = v_id
     WHERE id = v_enl.id AND clinica_id = p_clinica_id;
  ELSE
    UPDATE public.reserva_verificaciones SET consumida_en = now() WHERE id = v_verif;
  END IF;

  -- Además de cita_alta ('system') de log_cita_change: quién fue el canal. Sin datos personales.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES ('system', 'cita_reservada_enlace', 'appointments', v_id,
          jsonb_build_object('clinica_id', p_clinica_id, 'enlace_id', v_enl.id, 'canal', v_enl.clase,
                             'aviso', p_aviso_version)::text);

  r_resultado := 'ok'; r_cita_id := v_id; r_inicio := p_inicio; r_fin := v_fin;
  r_historial := coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0);
  RETURN NEXT;
END
$fn$;

-- ---------------------------------------------------------------------
-- 11 · RLS, policies y permisos. Nada se deja a los privilegios de
--      fábrica: REVOKE ALL y GRANT exactos. Sin DELETE ni TRUNCATE para
--      nadie (TRUNCATE no pasa por la RLS ni por los disparadores de fila).
--      Ninguna policy lee su propia tabla (sin recursión); los helpers son
--      DEFINER (pre-vuelo).
-- ---------------------------------------------------------------------
ALTER TABLE public.reserva_avisos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_enlaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_verificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_incidencias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_contactos      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.reserva_avisos, public.reserva_enlaces, public.reserva_verificaciones,
                    public.reserva_incidencias, public.reserva_contactos
  FROM PUBLIC, anon, authenticated, service_role;
-- Metadatos globales del aviso: los lee la sesión; sólo el editor SQL aprueba.
GRANT SELECT ON TABLE public.reserva_avisos TO authenticated, service_role;
-- La sesión ve y revoca (o pausa) los enlaces que gestiona. Su INSERT llega
-- al disparador, que lo rechaza (42501): emitir es sólo de service_role.
GRANT SELECT, INSERT, UPDATE, MAINTAIN ON TABLE public.reserva_enlaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.reserva_enlaces TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reserva_verificaciones TO service_role;
-- Las incidencias las escribe sólo el disparador DEFINER.
GRANT SELECT ON TABLE public.reserva_incidencias TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, MAINTAIN ON TABLE public.reserva_contactos TO authenticated;
GRANT SELECT ON TABLE public.reserva_contactos TO service_role;

CREATE POLICY reserva_avisos_select ON public.reserva_avisos FOR SELECT TO authenticated USING (true);

-- Sin policy de INSERT ni de DELETE: la emisión es sólo de service_role (que
-- no pasa por la RLS), así que sin policy la sesión queda denegada también si
-- algún día faltara el disparador.
CREATE POLICY reserva_enlaces_select ON public.reserva_enlaces FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
CREATE POLICY reserva_enlaces_update ON public.reserva_enlaces FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));

CREATE POLICY reserva_incidencias_select ON public.reserva_incidencias FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));

CREATE POLICY reserva_contactos_select ON public.reserva_contactos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
CREATE POLICY reserva_contactos_insert ON public.reserva_contactos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
CREATE POLICY reserva_contactos_update ON public.reserva_contactos FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));

-- Funciones: ninguna para PUBLIC. Las de disparador, a los tres roles (corren
-- con el rol de quien escribe); la reserva pública, sólo service_role; el
-- candado de la clínica, con la sesión.
REVOKE ALL ON FUNCTION
  public.proteger_reserva_enlaces(), public.proteger_reserva_enlace_unico(), public.proteger_reserva_contactos(),
  public.reserva_registrar_incidencia(),
  public.reserva_contacto_estado(uuid, uuid, text, text), public.reserva_contacto_marcar(uuid, text),
  public.reserva_contactos_bloqueados(),
  public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.reserva_contexto(text, text, text), public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz),
  public.reserva_codigo_emitir(uuid, uuid, text, text), public.reserva_codigo_verificar(uuid, uuid, text, text, text),
  public.reserva_espera_reenvio(uuid, uuid, text, integer), public.rate_limit_espera(text, integer, integer),
  public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.proteger_reserva_enlaces(), public.proteger_reserva_enlace_unico(), public.proteger_reserva_contactos(),
  public.reserva_registrar_incidencia()
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserva_contacto_marcar(uuid, text), public.reserva_contactos_bloqueados()
  TO authenticated;
GRANT EXECUTE ON FUNCTION
  public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.reserva_contexto(text, text, text), public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz),
  public.reserva_codigo_emitir(uuid, uuid, text, text), public.reserva_codigo_verificar(uuid, uuid, text, text, text),
  public.reserva_espera_reenvio(uuid, uuid, text, integer), public.rate_limit_espera(text, integer, integer),
  public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)
  TO service_role;

-- ---------------------------------------------------------------------
-- 12 · Comentarios.
-- ---------------------------------------------------------------------
COMMENT ON TABLE public.reserva_avisos IS
  'Versiones del aviso de privacidad de la reserva por enlace. Sólo el editor SQL aprueba. Sin una versión aprobada cuyo texto_sha256 coincida con el texto del código (src/lib/reserva/avisoReserva.ts), ningún enlace reserva.';
COMMENT ON TABLE public.reserva_enlaces IS
  'Enlaces de reserva. El código NO se guarda: se deriva en el servidor (HMAC con RESERVA_SECRETO sobre el id) y aquí sólo vive sha256(código). Un fijo vigente por médico; los únicos congelan vigencia_dias/caduca_en al emitir. Los emite sólo service_role (reserva_enlace_emitir). Se revocan, nunca se borran. Rotar RESERVA_SECRETO invalida TODOS los enlaces.';
COMMENT ON COLUMN public.reserva_enlaces.correo IS
  'Correo del paciente que escribió la clínica al emitir un enlace ÚNICO (opcional). El comprobante y todos los correos de la cita van SÓLO aquí; el que teclee quien reserva no se usa. Nunca viaja a la página pública ni a la lista de enlaces. Inmutable (trg_reserva_enlaces_unico).';
COMMENT ON COLUMN public.reserva_enlaces.correo_hmac IS
  'HMAC(RESERVA_SECRETO) del correo normalizado, el seudónimo del candado (el mismo que usa el fijo al verificar). Lo calcula el servidor.';
COMMENT ON COLUMN public.reserva_enlaces.intentos IS
  'Llamadas a reservar_por_enlace con este único vigente (sin contar los reenvíos ''repetida''). Sólo la sube service_role (la RPC).';
COMMENT ON COLUMN public.reserva_enlaces.agotado_en IS
  'El único ya no sirve por el tope de intentos (5) o porque un intento dio ''bloqueado''. Sólo service_role lo pone y no se quita. La página dice «Este enlace ya no está disponible», sin la causa.';
COMMENT ON COLUMN public.reserva_enlaces.pausado_en IS
  'El enlace FIJO apagado desde «Tu enlace» sin revocarlo; NULL = prendido. Al volver a NULL sirve la MISMA dirección (el código sale del id). CONVENIO: toda función que abra un enlace para el público lo trata como revocado (reserva_contexto, reservar_por_enlace, reagendar_por_enlace, cita_reagendar_oferta, reserva_ocupacion, reserva_codigo_emitir: «revocado_en IS NULL AND pausado_en IS NULL»); quien escriba otra, igual. Sólo el fijo (reserva_enlaces_pausado_check).';
COMMENT ON TABLE public.reserva_incidencias IS
  'Cancelaciones y no_show de citas por enlace (el candado). La escribe SÓLO reserva_registrar_incidencia(). anulada_en = la cita se reactivó. Seudónimos (HMAC), sin datos en claro. El conteo automático (reserva_contacto_estado) mira sólo correo_hmac; tel_hmac se guarda pero no cuenta.';
COMMENT ON TABLE public.reserva_contactos IS
  'Bloqueo (bloqueado_en) y desbloqueo (perdonado_en) manuales por contacto y médico. Desbloquear también descuenta las incidencias anteriores. Lo escribe reserva_contacto_marcar(). medico_id es siempre un médico de clinica_id (proteger_reserva_contactos, para todos salvo postgres/supabase_admin; auditoría ronda 1, A3): la FK es de una sola columna. Es la MISMA condición que proteger_reserva_enlaces() exige al médico de un enlace: un perfil con role = ''medico'' y la clinica_id de la fila; ninguna de las dos filtra por activo o eliminado (profiles no tiene esas columnas), y las dos exentan sólo a postgres/supabase_admin. Ser administrador de la clínica es es_admin_de_clinica de un médico, no otro rol.';

COMMENT ON COLUMN public.appointments.reserva_enlace_id IS
  'Enlace de reserva_enlaces del que nació la cita. La FK compuesta (reserva_enlace_id, clinica_id) impide colgarla de un enlace de otra clínica. Va junto con reserva_canal (appointments_reserva_check).';
COMMENT ON COLUMN public.appointments.reserva_canal IS
  'fijo | unico = la cita nació de una reserva por enlace. «Por ligar» = reserva_canal no nulo y paciente_id nulo. CONVENIO: una cita por ligar se trata como cita (no como evento genérico) en tarjetas, conteos, cancelación y tipo de cita; y su título NO lo cambia Google. Teléfono, correo y *_hmac nunca viajan a Google.';
COMMENT ON COLUMN public.appointments.reserva_nombre IS
  'Nombre de quien reservó por enlace, sin paciente todavía. Se queda en la cita al ligarla a un paciente. Mientras la cita esté por ligar, el espejo de Google (gcal_citas_por_evento) lo devuelve como nombre completo del «paciente» con apellidos vacíos.';
COMMENT ON COLUMN public.appointments.reserva_telefono IS
  'Teléfono de quien reservó (10 dígitos). Puede quedar NULL tras una supresión ARCO; los *_hmac se quedan para el candado.';
COMMENT ON COLUMN public.appointments.reserva_correo IS
  'Correo de quien reservó. Aquí sólo se valida la longitud; la forma la valida el servidor (Zod) y reservar_por_enlace exige una arroba. Puede quedar NULL tras una supresión ARCO; reserva_correo_hmac se queda para el candado.';
COMMENT ON COLUMN public.appointments.reserva_tel_hmac IS
  'HMAC-SHA256 (hex) del teléfono normalizado con la subllave «contacto» de RESERVA_SECRETO. Llave del bloqueo manual junto con reserva_correo_hmac. Rotar el secreto rompe el historial.';
COMMENT ON COLUMN public.appointments.reserva_correo_hmac IS
  'Seudónimo del correo de quien reservó por enlace: HMAC(RESERVA_SECRETO) del correo normalizado. En el único, el correo es el que escribió la clínica en el enlace. EXCEPCIÓN: una reserva por enlace único SIN correo lleva sha256(''reserva-sin-correo:''||id de la cita) en hex, propio de esa reserva: no es el HMAC de nada y no sirve para buscar a la persona (para eso está el teléfono).';
COMMENT ON COLUMN public.appointments.reserva_aviso_version IS
  'Versión de reserva_avisos que aceptó quien reservó (FK). Sin una versión aprobada con el mismo texto_sha256 que el código, no se reserva.';
COMMENT ON COLUMN public.appointments.reserva_aceptado_en IS
  'Cuándo aceptó quien reservó el aviso de reserva_aviso_version.';
COMMENT ON COLUMN public.appointments.reserva_historial_previo IS
  'Cancelaciones + inasistencias que el contacto traía con ese médico AL RESERVAR (instantánea que escribe reservar_por_enlace; no se recalcula). CONVENIO QUE LA BASE NO IMPONE: nada revalida que el número fuera el real en ese instante.';
COMMENT ON COLUMN public.appointments.reserva_reagendados IS
  'Posición en la cadena de reagendados. 0 en una cita no reagendada; la cita NUEVA de un reagendado lleva origen + 1 (sólo la escribe reagendar_por_enlace; la de origen no cambia). Tope agenda_ajustes.candado_reagendados. Única reserva_* con DEFAULT (cita_proteger_reserva lo tolera).';

COMMENT ON FUNCTION public.proteger_reserva_enlaces() IS
  'Protección de reserva_enlaces. Decide con current_user: postgres/supabase_admin libres; INSERT sólo service_role (el código y su hash los calcula el servidor con RESERVA_SECRETO); lo emitido no se modifica; revocar una vez (también service_role), sin reactivar; marcar usado sólo service_role y una vez. Quien la reemplace parte de este cuerpo.';
COMMENT ON FUNCTION public.reserva_contacto_estado(uuid, uuid, text, text) IS
  'Estado del candado de un contacto con un médico. manual = bloqueo a mano vigente por el teléfono O por el correo. cancelaciones / no_shows / hasta y el bloqueo automático cuentan SÓLO las incidencias del CORREO (correo_hmac) dentro de la ventana y después del último desbloqueo del correo: el teléfono no se verifica y no debe poder perjudicar a un tercero. bloqueado = manual OR automático.';
COMMENT ON FUNCTION public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text) IS
  'Emite un enlace de reserva. Sólo service_role, llamada desde POST /api/agenda/enlaces con la clínica de la sesión y el actor; repite la regla de las policies de reserva_enlaces con p_actor. Fijo: revoca el vigente y emite otro, atómico. Único: emite (la vigencia la congela el disparador), con p_correo y p_correo_hmac, los dos o ninguno. El hmac lo calcula el servidor con RESERVA_SECRETO.';
COMMENT ON FUNCTION public.reserva_contexto(text, text, text) IS
  'Contexto público de un enlace de reserva (estado vigente | usado | caducado | agotado). NULL = 404 indistinguible. Sólo service_role. CONVENIO: los tipos van todos juntos, con consultorio_id y principal; qué tipos valen en cada consultorio (el principal por consultorio sustituye allí al general) lo decide el servidor antes de reservar (tiposDelConsultorio, src/lib/agenda/tiposPorConsultorio.ts). reservar_por_enlace no mira el consultorio del tipo. NO devuelve el correo del enlace: no debe llegar a la página.';
COMMENT ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) IS
  'Lo que ocupa en el enlace de reserva: sólo puntas. Las citas y eventos CON HORA del médico del enlace menos cancelled y no_show (las filas de TODO EL DÍA no ocupan), y sus bloqueos (agenda_bloqueos). Sólo service_role; interruptor apagado o enlace revocado o pausado = nada; rango ≤ 15 días.';
COMMENT ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) IS
  'Reserva por enlace fijo: comprueba el código del correo (5 equivocados por código, 10 min) y, si vale, deja la ficha de un uso (30 min). Devuelve ok | sin_codigo | agotado | caducado | incorrecto | reemplazado. reemplazado: el código es el de un correo ANTERIOR de este enlace y correo (lo invalidó un reenvío), todavía sin vencer; NO suma equivocado. Sólo service_role.';
COMMENT ON FUNCTION public.reserva_espera_reenvio(uuid, uuid, text, integer) IS
  'Segundos que faltan para poder emitir otro código a ese correo EN ESE ENLACE (p_segundos desde el último emitido; 0 = ya). Filtra por clinica_id y enlace_id: desde otro enlace no revela nada; desde ESE enlace sí dice, durante 30 s, que ese correo pidió un código ahí (aceptado: un bit, una ventana de 30 s, tras los límites de IP y dispositivo, y sondear sin espera manda un código al titular). No escribe; consulta NO atómica (dos peticiones simultáneas pueden pasar las dos; el tope de 3 por correo por hora, en rate_limit_intento, sí lo es). Sólo service_role.';
COMMENT ON FUNCTION public.rate_limit_espera(text, integer, integer) IS
  'Segundos que faltan para que `p_ruta` vuelva a tener sitio con un tope de `p_limite` en `p_ventana_seg` segundos (0 = ya cabe). Cuenta como rate_limit_intento (renglones de ip_rate_limits de esa ruta dentro de la ventana) y no escribe. Sólo service_role (rutas públicas de la reserva: Retry-After de los límites por red, navegador y enlace; los 30 s entre códigos los da reserva_espera_reenvio). Consulta NO atómica: informa, no sustituye a rate_limit_intento (dos peticiones simultáneas pueden pasar las dos). p_ventana_seg no debe exceder la ventana con la que rate_limit_intento cuenta esa ruta: lo que sale de ella ya se borró.';
COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace. Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790, que también toman los bloqueos). CONVENIO: horario del consultorio y alineación del turno (rejilla fija) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. Ocupa lo que tiene hora (no lo de todo el día) y todo bloqueo del médico (agenda_bloqueos) que toque el turno: ''ocupado''. En el fijo la ficha del correo va antes que el candado; bloqueado = manual (teléfono o correo, también en el único) o automático por correo (sólo fijo); «1 activa» sólo por correo. A PROPÓSITO: el manual por teléfono no exige que el correo verificado sea de la misma persona, así que un «bloqueado» delata que la clínica bloqueó a mano ese teléfono (AG-DT-28, decisión de Angel). p_correo y p_correo_hmac pueden llegar NULL juntos; el fijo sin correo da correo_sin_verificar. En el ÚNICO se IGNORAN p_correo y p_correo_hmac: la cita lleva el correo que escribió la clínica al emitir el enlace (reserva_enlaces.correo y su correo_hmac) o ninguno; sin él, reserva_correo NULL y reserva_correo_hmac = sha256(''reserva-sin-correo:''||id de la cita) en hex (seudónimo propio, que no es el HMAC de ningún correo). Tope del único: cada llamada con un único vigente que no sea ''repetida'' suma reserva_enlaces.intentos; la 5.ª marca agotado_en; ''bloqueado'' lo agota en el acto; agotado devuelve ''enlace_agotado''; un client_id que ya es de otra cita, ''client_id_en_uso'' (contado; también en carrera, porque el INSERT atrapa el unique_violation de idx_appointments_client_id sin deshacer el conteo). Devuelve UNA fila: usar .single(). LÍMITE ACEPTADO (auditoría ronda 1, A7; decisión de Angel): el bloqueo y la reserva son totales salvo carrera de milisegundos, y dentro de Spinus el empalme avisa: el alta de una cita por el personal no toma el candado 1790, así que una reserva por enlace o un bloqueo confirmados a la vez pueden dejar dos citas en el turno o una cita dentro del bloqueo.';

-- ---------------------------------------------------------------------
-- 13 · Post-vuelo: comprueba lo que se acaba de crear. Aborta (y deshace
--      todo) si algo no quedó como debe.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_t    text;
  v_n    integer;
  v_src  text;
  v_mal  text[];
  c_tablas CONSTANT text[] := ARRAY['reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones',
                                    'reserva_incidencias', 'reserva_contactos'];
  c_solo_service CONSTANT regprocedure[] := ARRAY[
    'public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)'::regprocedure,
    'public.reserva_contexto(text, text, text)'::regprocedure,
    'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'::regprocedure,
    'public.reserva_codigo_emitir(uuid, uuid, text, text)'::regprocedure,
    'public.reserva_codigo_verificar(uuid, uuid, text, text, text)'::regprocedure,
    'public.reserva_espera_reenvio(uuid, uuid, text, integer)'::regprocedure,
    'public.rate_limit_espera(text, integer, integer)'::regprocedure,
    'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'::regprocedure];
BEGIN
  -- RLS activa y sin TRUNCATE ni DELETE para los tres roles; anon, nada.
  FOREACH v_t IN ARRAY c_tablas LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || v_t)::regclass) THEN
      RAISE EXCEPTION 'POST-VUELO F3: % sin RLS.', v_t;
    END IF;
    IF has_table_privilege('anon', 'public.' || v_t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated', 'public.' || v_t, 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('service_role', 'public.' || v_t, 'DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'POST-VUELO F3: % concede de más (anon, DELETE o TRUNCATE).', v_t;
    END IF;
  END LOOP;
  -- Policies: sin INSERT en reserva_enlaces y sin DELETE en ninguna.
  SELECT array_agg(tablename || ':' || cmd ORDER BY tablename, cmd) INTO v_mal FROM pg_policies
   WHERE schemaname = 'public' AND tablename = ANY (c_tablas);
  IF v_mal IS DISTINCT FROM ARRAY['reserva_avisos:SELECT', 'reserva_contactos:INSERT', 'reserva_contactos:SELECT',
       'reserva_contactos:UPDATE', 'reserva_enlaces:SELECT', 'reserva_enlaces:UPDATE', 'reserva_incidencias:SELECT'] THEN
    RAISE EXCEPTION 'POST-VUELO F3: policies inesperadas: %.', v_mal;
  END IF;
  -- Funciones: ninguna ejecutable por PUBLIC; todas con search_path vacío;
  -- sólo el disparador de incidencias es DEFINER.
  SELECT array_agg(p.oid::regprocedure::text) INTO v_mal FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('proteger_reserva_contactos', 'proteger_reserva_enlace_unico', 'proteger_reserva_enlaces',
                       'rate_limit_espera', 'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reserva_contacto_estado',
                       'reserva_contacto_marcar', 'reserva_contactos_bloqueados', 'reserva_contexto', 'reserva_enlace_emitir',
                       'reserva_espera_reenvio', 'reserva_ocupacion', 'reserva_registrar_incidencia', 'reservar_por_enlace')
     AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0)
          OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']
          OR p.prosecdef <> (p.proname = 'reserva_registrar_incidencia'));
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO F3: funciones con PUBLIC, sin search_path vacío o con la seguridad cambiada: %.', v_mal;
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('reserva_enlace_emitir', 'reserva_enlace_regenerar_fijo');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'POST-VUELO F3: tiene que quedar sólo la reserva_enlace_emitir de 9 argumentos (hay % candidatas).', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(c_solo_service) f
              WHERE NOT has_function_privilege('service_role', f, 'EXECUTE')
                 OR has_function_privilege('anon', f, 'EXECUTE')
                 OR has_function_privilege('authenticated', f, 'EXECUTE')) THEN
    RAISE EXCEPTION 'POST-VUELO F3: una función de la reserva pública no es sólo de service_role.';
  END IF;
  IF has_function_privilege('anon', 'public.reserva_contacto_estado(uuid, uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reserva_contacto_marcar(uuid, text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.reserva_contacto_marcar(uuid, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reserva_contactos_bloqueados()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.reserva_contactos_bloqueados()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO F3: el candado de la clínica concede de más.';
  END IF;

  -- appointments: 11 columnas reserva_*; sólo reserva_reagendados con DEFAULT.
  SELECT count(*), array_agg(a.attname::text) FILTER (WHERE a.atthasdef AND a.attname <> 'reserva_reagendados')
    INTO v_n, v_mal FROM pg_attribute a
   WHERE a.attrelid = 'public.appointments'::regclass AND a.attname LIKE 'reserva\_%' AND NOT a.attisdropped;
  IF v_n <> 11 OR v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO F3: appointments tiene % columnas reserva_* o alguna con DEFAULT de más (%).', v_n, v_mal;
  END IF;
  -- Sin el prefijo public.: pg_get_constraintdef lo pone o no según el search_path.
  SELECT md5(replace(pg_get_constraintdef(oid), 'public.', '')) INTO v_src FROM pg_constraint
   WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_reserva_check';
  IF v_src IS DISTINCT FROM '12f5eb0a7cae5d1b7813634001f9c5c4' THEN
    RAISE EXCEPTION 'POST-VUELO F3: appointments_reserva_check no tiene la fórmula esperada (md5 %, se espera 12f5eb0a…).', v_src;
  END IF;
  -- Ninguna FK de este bloque borra en cascada.
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE contype = 'f' AND confdeltype = 'c'
                AND (conrelid IN (SELECT ('public.' || t)::regclass FROM unnest(c_tablas) t)
                     OR conname IN ('appointments_reserva_enlace_fkey', 'appointments_reserva_aviso_fkey'))) THEN
    RAISE EXCEPTION 'POST-VUELO F3: una FK del bloque es ON DELETE CASCADE.';
  END IF;

  -- Disparadores, activos y con su función. El nombre de la función se arma
  -- con su esquema (no con ::regproc, que lo omite o no según el search_path).
  SELECT array_agg(c.relname || '.' || t.tgname || '=' || fn.nspname || '.' || f.proname ORDER BY c.relname, t.tgname)
    INTO v_mal
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc f ON f.oid = t.tgfoid JOIN pg_namespace fn ON fn.oid = f.pronamespace
   WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal AND t.tgenabled = 'O'
     AND (c.relname = ANY (c_tablas) OR t.tgname = 'trg_appointments_reserva_incidencia');
  IF v_mal IS DISTINCT FROM ARRAY[
       'appointments.trg_appointments_reserva_incidencia=public.reserva_registrar_incidencia',
       'reserva_avisos.audit_reserva_avisos=public.log_tabla_change',
       'reserva_contactos.audit_reserva_contactos=public.log_tabla_change',
       'reserva_contactos.trg_reserva_contactos_proteger=public.proteger_reserva_contactos',
       'reserva_enlaces.audit_reserva_enlaces=public.log_tabla_change',
       'reserva_enlaces.trg_reserva_enlaces_proteger=public.proteger_reserva_enlaces',
       'reserva_enlaces.trg_reserva_enlaces_unico=public.proteger_reserva_enlace_unico'] THEN
    RAISE EXCEPTION 'POST-VUELO F3: disparadores inesperados: %.', v_mal;
  END IF;

  -- Lo que otros bloques y CLAUDE.md dan por hecho de estos cuerpos. md5
  -- exacto, sin normalizar: el cuerpo nace aquí, del archivo (LF).
  SELECT md5(prosrc) INTO v_src FROM pg_proc WHERE oid = 'public.proteger_reserva_enlaces()'::regprocedure;
  IF v_src IS DISTINCT FROM 'acd4128b5f25df54f6b4fd95391cf1dc' THEN
    RAISE EXCEPTION 'POST-VUELO F3: proteger_reserva_enlaces() no es el cuerpo acd4128b… (md5 %; ¿archivo con CRLF?).', v_src;
  END IF;
  SELECT prosrc INTO v_src FROM pg_proc
   WHERE oid = 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'::regprocedure;
  SELECT array_agg(f) INTO v_mal FROM unnest(ARRAY[
      'v_enl.pausado_en IS NOT NULL', 'FOR UPDATE;', 'pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text))',
      'c_tope_unico CONSTANT integer := 5', 'v_correo := v_enl.correo;', 'v_correo_hmac := v_enl.correo_hmac;',
      'NOT a.all_day', 'OR EXISTS (SELECT 1 FROM public.agenda_bloqueos b', 'public.gcal_sync_clinica_habilitada(p_clinica_id)',
      'EXCEPTION WHEN unique_violation THEN', '''idx_appointments_client_id''',
      'encode(sha256(convert_to(''reserva-sin-correo:'' || v_id::text, ''UTF8'')), ''hex'')',
      'public.reserva_contacto_estado(p_clinica_id, v_enl.medico_id, p_tel_hmac, v_correo_hmac)']) f
   WHERE position(f IN v_src) = 0;
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO F3: a reservar_por_enlace le falta: %.', v_mal;
  END IF;
  -- Orden que importa: el conteo del único, luego client_id_en_uso, antes de
  -- mirar a la persona; y el INSERT, al final, en su bloque.
  IF NOT (position('SET intentos = intentos + 1' IN v_src) < position('''client_id_en_uso''' IN v_src)
          AND position('''client_id_en_uso''' IN v_src) < position('public.reserva_contacto_estado(' IN v_src)
          AND position('public.reserva_contacto_estado(' IN v_src) < position('INSERT INTO public.appointments' IN v_src)) THEN
    RAISE EXCEPTION 'POST-VUELO F3: reservar_por_enlace cambió el orden contador → client_id_en_uso → candado → INSERT.';
  END IF;
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'::regprocedure;
  IF position('public.agenda_bloqueos' IN v_src) = 0 OR position('NOT a.all_day' IN v_src) = 0
     OR position('e.pausado_en IS NULL' IN v_src) = 0 THEN
    RAISE EXCEPTION 'POST-VUELO F3: a reserva_ocupacion le falta el bloqueo, el «NOT a.all_day» o la pausa.';
  END IF;
  -- El bloqueo automático cuenta por correo, nunca por teléfono.
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.reserva_contacto_estado(uuid, uuid, text, text)'::regprocedure;
  IF position('x.correo_hmac = p_correo_hmac' IN v_src) = 0 OR position('x.tel_hmac' IN v_src) > 0 THEN
    RAISE EXCEPTION 'POST-VUELO F3: reserva_contacto_estado ya no cuenta las incidencias sólo por el correo.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 14 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tablas con RLS (de 5)' AS comprobacion,
         (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity
           AND relname IN ('reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones', 'reserva_incidencias', 'reserva_contactos')) AS valor,
         '5' AS esperado
  UNION ALL
  SELECT 2, 'policies (tabla:comando)',
         (SELECT string_agg(tablename || ':' || cmd, ',' ORDER BY tablename, cmd) FROM pg_policies
           WHERE schemaname = 'public' AND tablename LIKE 'reserva\_%' AND tablename <> 'reserva_empalmes_google'),
         'reserva_avisos:SELECT,reserva_contactos:INSERT,reserva_contactos:SELECT,reserva_contactos:UPDATE,reserva_enlaces:SELECT,reserva_enlaces:UPDATE,reserva_incidencias:SELECT'
  UNION ALL
  SELECT 3, 'appointments: columnas reserva_* / con DEFAULT',
         (SELECT count(*)::text || ' / ' || coalesce(string_agg(attname, ',') FILTER (WHERE atthasdef), '-') FROM pg_attribute
           WHERE attrelid = 'public.appointments'::regclass AND attname LIKE 'reserva\_%' AND NOT attisdropped),
         '11 / reserva_reagendados'
  UNION ALL
  SELECT 4, 'appointments: restricciones de la reserva',
         (SELECT string_agg(conname || '=' || contype::text, ',' ORDER BY conname) FROM pg_constraint
           WHERE conrelid = 'public.appointments'::regclass AND conname LIKE 'appointments_reserva_%'),
         'appointments_reserva_aviso_fkey=f,appointments_reserva_check=c,appointments_reserva_enlace_fkey=f,appointments_reserva_reagendados_check=c'
  UNION ALL
  SELECT 5, 'funciones del bloque / ejecutables por PUBLIC / DEFINER',
         (SELECT count(*)::text || ' / '
                 || count(*) FILTER (WHERE EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))::text || ' / '
                 || coalesce(string_agg(p.proname, ',') FILTER (WHERE p.prosecdef), '-')
            FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('proteger_reserva_contactos', 'proteger_reserva_enlace_unico', 'proteger_reserva_enlaces',
                               'rate_limit_espera', 'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reserva_contacto_estado',
                               'reserva_contacto_marcar', 'reserva_contactos_bloqueados', 'reserva_contexto', 'reserva_enlace_emitir',
                               'reserva_enlace_regenerar_fijo', 'reserva_espera_reenvio', 'reserva_ocupacion',
                               'reserva_registrar_incidencia', 'reservar_por_enlace')),
         '15 / 0 / reserva_registrar_incidencia'
  UNION ALL
  SELECT 6, 'proteger_reserva_enlaces() md5(prosrc)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')), 'AUSENTE'),
         'acd4128b5f25df54f6b4fd95391cf1dc'
  UNION ALL
  SELECT 7, 'disparador de incidencias en appointments',
         coalesce((SELECT fn.nspname || '.' || f.proname FROM pg_trigger t
                     JOIN pg_proc f ON f.oid = t.tgfoid JOIN pg_namespace fn ON fn.oid = f.pronamespace
                    WHERE t.tgrelid = 'public.appointments'::regclass
                      AND t.tgname = 'trg_appointments_reserva_incidencia' AND t.tgenabled = 'O'), 'AUSENTE'),
         'public.reserva_registrar_incidencia'
  UNION ALL
  SELECT 8, 'TRUNCATE en las 5 tablas (anon, authenticated, service_role)',
         (SELECT count(*)::text FROM unnest(ARRAY['reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones',
                                                  'reserva_incidencias', 'reserva_contactos']) t
           CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
           WHERE has_table_privilege(r, 'public.' || t, 'TRUNCATE')),
         '0'
  UNION ALL
  SELECT 9, 'censo: citas por enlace / enlaces / avisos aprobados',
         (SELECT count(*)::text FROM public.appointments WHERE reserva_canal IS NOT NULL) || ' / '
         || (SELECT count(*)::text FROM public.reserva_enlaces) || ' / '
         || (SELECT count(*)::text FROM public.reserva_avisos WHERE aprobado), NULL
) t
ORDER BY t.n;
