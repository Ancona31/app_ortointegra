-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F5b — PROTECCIONES DE LA CITA (disparadores BEFORE de appointments)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE, sobre public.appointments:
--   · dos índices de rango de la agenda;
--   · cerrada_en / sustituida_por, con su FK RESTRICT, su CHECK y su índice;
--   · seis disparadores BEFORE, todos INVOKER, que deciden por current_user:
--       trg_appointments_horario_bloqueado  cita_proteger_bloqueo()   nada entra ni se mueve a un bloqueo
--       trg_appointments_proteger_atendida  cita_proteger_atendida()  la atendida con nota no cambia ni se borra
--       trg_appointments_proteger_borrado   cita_proteger_borrado()   con la v2, la cita con paciente se cancela
--       trg_appointments_proteger_cierre    cita_proteger_cierre()    sólo el servidor cierra una cancelada
--       trg_appointments_proteger_eleccion  cita_proteger_eleccion()  la reservada por enlace sólo cambia con «Reagendar»
--       trg_appointments_proteger_reserva   cita_proteger_reserva()   las reserva_* sólo las escribe el servidor
--     más cita_tiene_nota_ligada(uuid, uuid), SECURITY DEFINER, sólo booleano.
--
-- DE QUÉ DEPENDE (lo comprueba el pre-vuelo; aborta si falta):
--   · Va la ÚLTIMA del conjunto (F1 → F5a → F3 → F2 → F4 → F5b). PostgreSQL 14
--     o posterior (CREATE OR REPLACE TRIGGER); producción es 17.
--   · Rol: postgres (dueño de appointments, con BYPASSRLS). En Supabase, el
--     usuario postgres.<ref> del pooler; desde supabase_admin, SET ROLE postgres.
--   · main: appointments (CHECK de status con 'attended' y 'cancelled', y su
--     llave primaria válida), consultas.appointment_id, pacientes.clinica_id,
--     auth.uid(), get_clinica_id().
--   · F1: agenda_ajustes y agenda_v2_encendida(uuid) INVOKER.
--   · F3: las columnas appointments.reserva_* (reserva_reagendados DEFAULT 0 y
--     ninguna otra con DEFAULT) y reserva_canal.
--   · F5a: agenda_bloqueos y su policy de SELECT.
--   · F4 (al ejecutarse, no al crearse): cita_reagendar_clinica pone el GUC
--     spinus.reagendar_cita que exime a cita_proteger_eleccion.
--   · Ninguna comprobación depende del search_path de la sesión (probado con
--     '', public y "$user", public, extensions).
--
-- RIESGO: MEDIO.
--   · Bloqueos (lock_timeout 5 s; si no los obtiene, aborta sin cambiar nada):
--       - los dos CREATE INDEX de rango toman SHARE sobre appointments: desde
--         ahí y hasta el COMMIT las ESCRITURAS de citas esperan; las lecturas
--         no. Lo que más dura es construirlos (proporcional a las filas);
--       - cinco CREATE TRIGGER, SHARE ROW EXCLUSIVE (lo mismo para lecturas);
--       - el bloque de la cancelada cerrada (ADD COLUMN) toma ACCESS EXCLUSIVE:
--         desde ahí hasta el COMMIT esperan también las LECTURAS de citas. Por
--         eso va al final, tras las funciones, los índices y cinco de los seis
--         disparadores, en un solo bloque: detrás sólo quedan el disparador del
--         cierre (que necesita las columnas), el post-vuelo y el COMMIT.
--       - Si al pedir el ACCESS EXCLUSIVE hay una lectura larga en curso, las
--         lecturas nuevas se encolan detrás hasta 5 s (lock_timeout) y luego
--         F5b aborta entera: repetir con menos tráfico.
--   · Datos: no escribe ninguno. Las columnas nacen NULL; el CHECK y la FK se
--     cumplen sin tocar filas (pero se verifican recorriendo la tabla).
--   · Efecto: los disparadores CIERRAN caminos de escritura de appointments
--     (para todo rol salvo postgres/supabase_admin; el borrado y la atendida
--     también para service_role). Quien limpie citas (semilla, scripts) lo
--     hace como postgres o apaga antes la v2.
--   · Si falla: una sola transacción; no queda nada a medias.
--   · Segunda pasada: no cambia nada y sale bien (CREATE OR REPLACE / IF NOT
--     EXISTS). Si lo que ya existe tiene otra forma (función DEFINER, CHECK o
--     FK distintos, uno de sus índices inválido), aborta sin tocar nada.
--   · Vuelta atrás: supabase/reversas/20261201170000_agenda_f5b_protecciones_cita_reversa.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
  v_fk  record;
BEGIN
  -- Las funciones quedan a nombre de quien aplica; todas las de public son de
  -- postgres, y una DEFINER de otro dueño (supabase_admin, superusuario)
  -- correría con otros privilegios.
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicar como el rol postgres (current_user es %). En Supabase: conéctate con el usuario postgres.<ref> del pooler; desde supabase_admin, SET ROLE postgres.', current_user;
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_catalog.pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  -- cita_tiene_nota_ligada es DEFINER: su dueño (quien aplica) tiene que ver TODAS las notas.
  IF NOT (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no tiene BYPASSRLS; cita_tiene_nota_ligada vería sólo parte de las notas.', current_user;
  END IF;
  -- Los cuerpos plpgsql no se validan al crearse: las columnas que nombran, aquí.
  IF (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('status', 'text'::regtype),
                                    ('paciente_id', 'uuid'::regtype), ('medico_id', 'uuid'::regtype),
                                    ('consultorio_id', 'uuid'::regtype), ('start_time', 'timestamptz'::regtype),
                                    ('end_time', 'timestamptz'::regtype), ('all_day', 'bool'::regtype),
                                    ('reserva_canal', 'text'::regtype), ('reserva_telefono', 'text'::regtype),
                                    ('reserva_correo', 'text'::regtype), ('reserva_reagendados', 'int2'::regtype))) <> 13 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a appointments le falta alguna de las 13 columnas que nombran las funciones (las reserva_* son de F3).';
  END IF;
  IF coalesce(pg_get_constraintdef((SELECT oid FROM pg_catalog.pg_constraint WHERE conname = 'appointments_status_check'
                                     AND conrelid = 'public.appointments'::regclass)), '') !~ '''attended'''
     OR coalesce(pg_get_constraintdef((SELECT oid FROM pg_catalog.pg_constraint WHERE conname = 'appointments_status_check'
                                     AND conrelid = 'public.appointments'::regclass)), '') !~ '''cancelled''' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el CHECK de appointments.status no tiene ''attended'' y ''cancelled''.';
  END IF;
  -- cita_proteger_reserva lista las columnas reserva_* POR PREFIJO y exige que la
  -- sesión las cree NULL (reserva_reagendados, 0): si otra naciera con DEFAULT,
  -- el alta de citas con la sesión fallaría siempre.
  IF coalesce((SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a
                 ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                WHERE d.adrelid = 'public.appointments'::regclass AND a.attname = 'reserva_reagendados'), '') <> '0' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.reserva_reagendados no tiene DEFAULT 0 (F3).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
              WHERE d.adrelid = 'public.appointments'::regclass AND a.attname LIKE 'reserva\_%'
                AND a.attname <> 'reserva_reagendados' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay una columna reserva_* con DEFAULT además de reserva_reagendados; rompería el alta con la sesión.';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid = 'public.consultas'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('appointment_id', 'uuid'::regtype), ('paciente_id', 'uuid'::regtype))) <> 2
     OR (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid = 'public.pacientes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta consultas.appointment_id/paciente_id o pacientes.id/clinica_id.';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL
     OR (SELECT prorettype FROM pg_catalog.pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')) IS DISTINCT FROM 'uuid'::regtype THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta auth.uid() o public.get_clinica_id() → uuid.';
  END IF;
  -- F1 y F5a. Los disparadores leen agenda_ajustes y agenda_bloqueos con la RLS de quien escribe.
  IF to_regclass('public.agenda_ajustes') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = to_regprocedure('public.agenda_v2_encendida(uuid)')
                     AND NOT prosecdef AND prorettype = 'boolean'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan agenda_ajustes o agenda_v2_encendida(uuid) INVOKER (F1, 20261201120000).';
  END IF;
  IF NOT (has_function_privilege('authenticated', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
          AND has_table_privilege('authenticated', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated o service_role no leen el interruptor; los disparadores fallarían siempre.';
  END IF;
  IF to_regclass('public.agenda_bloqueos') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos'
                     AND policyname = 'agenda_bloqueos_select' AND cmd = 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.agenda_bloqueos', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.agenda_bloqueos', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_bloqueos con su policy de SELECT y sus permisos (F5a, 20261201130000).';
  END IF;
  -- Índices: la FK sustituida_por necesita la llave primaria VÁLIDA, y un
  -- índice propio inválido no lo arregla el IF NOT EXISTS. Un índice inválido
  -- AJENO no afecta a nada de lo que F5b crea: sólo se avisa.
  FOR v_def IN SELECT i.indexrelid::regclass::text FROM pg_catalog.pg_index i
                WHERE i.indrelid = 'public.appointments'::regclass AND NOT (i.indisvalid AND i.indisready)
                  AND (i.indisprimary OR i.indexrelid IN (to_regclass('public.idx_appointments_clinica_inicio'),
                                                          to_regclass('public.idx_appointments_clinica_medico_inicio'),
                                                          to_regclass('public.idx_appointments_sustituida_por'))) LOOP
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el índice % de appointments está INVALID (resto de un CREATE INDEX CONCURRENTLY o REINDEX abortado). Si es la llave primaria: REINDEX INDEX CONCURRENTLY %; si es de F5b: DROP INDEX CONCURRENTLY %. Fuera de una transacción, y volver a correr F5b.', v_def, v_def, v_def;
  END LOOP;
  FOR v_def IN SELECT i.indexrelid::regclass::text FROM pg_catalog.pg_index i
                WHERE i.indrelid = 'public.appointments'::regclass AND NOT (i.indisvalid AND i.indisready) LOOP
    RAISE WARNING 'F5b: el índice % de appointments está INVALID. No es de F5b y no le afecta; conviene quitarlo o reconstruirlo aparte (DROP INDEX CONCURRENTLY o REINDEX INDEX CONCURRENTLY).', v_def;
  END LOOP;
  -- Segunda pasada: lo que ya exista tiene que tener esta misma forma.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE prosecdef AND oid IN (
               to_regprocedure('public.cita_proteger_bloqueo()'), to_regprocedure('public.cita_proteger_atendida()'),
               to_regprocedure('public.cita_proteger_borrado()'), to_regprocedure('public.cita_proteger_cierre()'),
               to_regprocedure('public.cita_proteger_eleccion()'), to_regprocedure('public.cita_proteger_reserva()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: alguna cita_proteger_*() existe como SECURITY DEFINER; tienen que ser INVOKER.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')
              AND (NOT prosecdef OR prorettype <> 'bool'::regtype)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_tiene_nota_ligada(uuid, uuid) existe con otra forma (INVOKER u otro tipo).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
              AND ((attname = 'cerrada_en' AND atttypid <> 'timestamptz'::regtype)
                OR (attname = 'sustituida_por' AND atttypid <> 'uuid'::regtype))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cerrada_en o sustituida_por ya existen con otro tipo.';
  END IF;
  v_def := pg_get_constraintdef((SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid = 'public.appointments'::regclass
                                   AND conname = 'appointments_cierre_check'));
  IF v_def IS NOT NULL AND v_def <> 'CHECK ((((cerrada_en IS NULL) AND (sustituida_por IS NULL)) OR ((cerrada_en IS NOT NULL) AND (status = ''cancelled''::text) AND ((sustituida_por IS NULL) OR (sustituida_por <> id)))))' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_cierre_check existe con otra definición: %', v_def;
  END IF;
  -- La FK por catálogo, no por su texto: pg_get_constraintdef escribe la tabla
  -- referida con o sin esquema según el search_path de la sesión.
  SELECT c.contype, c.confrelid, c.confdeltype, c.confupdtype, c.confmatchtype,
         (SELECT array_agg(a.attname::text ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, n)
            JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols,
         (SELECT array_agg(a.attname::text ORDER BY k.n) FROM unnest(c.confkey) WITH ORDINALITY k(attnum, n)
            JOIN pg_catalog.pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS refs
    INTO v_fk
    FROM pg_catalog.pg_constraint c
   WHERE c.conrelid = 'public.appointments'::regclass AND c.conname = 'appointments_sustituida_por_fkey';
  IF FOUND AND (v_fk.contype, v_fk.confrelid, v_fk.confdeltype, v_fk.confupdtype, v_fk.confmatchtype, v_fk.cols, v_fk.refs)
               IS DISTINCT FROM ('f'::"char", 'public.appointments'::regclass, 'r'::"char", 'a'::"char", 's'::"char",
                                 ARRAY['sustituida_por'], ARRAY['id']) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_sustituida_por_fkey existe con otra definición: %',
      pg_get_constraintdef((SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid = 'public.appointments'::regclass
                              AND conname = 'appointments_sustituida_por_fkey'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Las funciones de los disparadores. No toman ningún bloqueo que frene
--     a appointments: van antes que los índices y las columnas para que el
--     tiempo con appointments bloqueada sea el menor posible.
--     TODAS INVOKER: deciden por current_user, el rol de quien escribe. Una
--     DEFINER vería siempre a su dueño (postgres) y abriría todas las puertas.
--     postgres y supabase_admin quedan fuera de todas (editor SQL, acciones
--     referenciales). service_role, según cada una: lo eximen la de reserva y la
--     de cierre (es quien escribe esas columnas), la de bloqueo sólo con Google
--     o con un alta por enlace, la de elección sólo con «Reagendar»; la de
--     borrado y la de atendida NO lo eximen.
--     PostgreSQL dispara los BEFORE ROW por orden alfabético de nombre: cuando
--     dos rechazan la misma fila gana el primero, y las rutas traducen el
--     error por su HINT. No renombres un disparador sin revisar ese orden.
-- ---------------------------------------------------------------------

-- 2.1 · ¿Tiene la cita una nota clínica? Sólo un booleano.
--     SECURITY DEFINER a propósito: la RLS de consultas oculta las notas a la
--     secretaria y a otros médicos, y la regla tiene que valer para ellos. NO la
--     hagas INVOKER. Con sesión sólo responde de la clínica de quien llama.
CREATE OR REPLACE FUNCTION public.cita_tiene_nota_ligada(p_cita uuid, p_clinica uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT coalesce(
           (auth.uid() IS NULL OR p_clinica = public.get_clinica_id())
           AND EXISTS (SELECT 1 FROM public.consultas c
                         JOIN public.pacientes p ON p.id = c.paciente_id
                        WHERE c.appointment_id = p_cita AND p.clinica_id = p_clinica),
           false)
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) IS
  'Agenda: ¿tiene la cita p_cita una nota clínica (consultas.appointment_id) de un paciente de p_clinica? SECURITY DEFINER porque la RLS de consultas oculta las notas a la secretaria y a otros médicos; devuelve SÓLO un booleano. Con sesión, sólo responde de la clínica de quien llama (otra → false). La usa cita_proteger_atendida(); sin EXECUTE para anon ni PUBLIC.';

-- 2.2 · Bloqueo total: nada entra ni se mueve a un bloqueo de su médico.
CREATE OR REPLACE FUNCTION public.cita_proteger_bloqueo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.medico_id IS NULL OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  -- Lo que ya estaba dentro se queda; sólo cuenta entrar (alta, o mover inicio,
  -- fin o médico). Este atajo y la lista de columnas del disparador son lo que
  -- deja cerrar una cancelada dentro de un bloqueo y editar lo que ya estaba
  -- dentro: no los quites.
  IF TG_OP = 'UPDATE' AND (NEW.start_time, NEW.end_time, NEW.medico_id)
                          IS NOT DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.medico_id) THEN
    RETURN NEW;
  END IF;
  -- Lo de Google entra como siempre, y la reserva por enlace ya rechaza los bloqueos ella misma.
  IF current_user = 'service_role'
     AND (current_setting('spinus.via', true) = 'google'
          OR (TG_OP = 'INSERT' AND NEW.reserva_canal IS NOT NULL)) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_bloqueos b
              WHERE b.clinica_id = NEW.clinica_id AND b.medico_id = NEW.medico_id
                AND b.inicio < NEW.end_time AND b.fin > NEW.start_time)
     AND public.agenda_v2_encendida(NEW.clinica_id) THEN
    RAISE EXCEPTION 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.'
      USING ERRCODE = '42501', HINT = 'agenda_horario_bloqueado';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_bloqueo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_bloqueo() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_bloqueo() IS
  'Agenda: con la v2 encendida, ninguna fila de appointments entra ni se mueve (inicio, fin o médico) a un periodo que se solape con un bloqueo de su médico (agenda_bloqueos). 42501, HINT agenda_horario_bloqueado, mensaje literal de Angel. Fuera: postgres/supabase_admin, service_role con spinus.via = google (lo de Google entra como siempre) y el alta de service_role con reserva_canal (reservar_por_enlace ya lo rechaza). Lo que ya estaba dentro se queda. INVOKER: lee agenda_bloqueos con la RLS de quien escribe. LÍMITE ACEPTADO (auditoría ronda 1, A7; decisión de Angel): el bloqueo y la reserva son totales salvo carrera de milisegundos, y dentro de Spinus el empalme avisa: el alta de una cita por el personal no toma el candado 1790, así que una reserva por enlace o un bloqueo confirmados a la vez pueden dejar dos citas en el turno o una cita dentro del bloqueo.';

-- 2.3 · La atendida con nota ligada no cambia de estado, no se mueve y no se
--       borra, con la v2 encendida o apagada; tampoco para service_role.
CREATE OR REPLACE FUNCTION public.cita_proteger_atendida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR OLD.status IS DISTINCT FROM 'attended' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- Ni estado, ni fecha u hora, ni todo el día; con la v2 encendida o apagada.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND (NEW.start_time, NEW.end_time, NEW.all_day) IS NOT DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.all_day) THEN
    RETURN NEW;
  END IF;
  IF public.cita_tiene_nota_ligada(OLD.id, OLD.clinica_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Una cita atendida con nota clínica no se borra'
        USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
    END IF;
    RAISE EXCEPTION 'Una cita atendida con nota clínica no cambia de estado ni de fecha u hora'
      USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_atendida() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_atendida() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_atendida() IS
  'Agenda: una cita atendida con nota clínica ligada no cambia de estado, no se mueve de fecha, hora o todo el día y no se borra, con la agenda v2 encendida o apagada, como vetoPorNotaLigada de la API. 42501. Lee OLD/NEW y cita_tiene_nota_ligada(); nunca appointments. postgres y supabase_admin quedan fuera (editor SQL, acciones referenciales); service_role, no.';

-- 2.4 · Con la v2 encendida, una cita con paciente o por ligar no se borra: se cancela.
--       Tampoco para service_role: un borrado de citas del servidor con la v2 falla.
CREATE OR REPLACE FUNCTION public.cita_proteger_borrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;
  IF OLD.paciente_id IS NULL AND OLD.reserva_canal IS NULL THEN
    RETURN OLD;
  END IF;
  IF public.agenda_v2_encendida(OLD.clinica_id) THEN
    RAISE EXCEPTION 'Una cita con paciente o por ligar no se borra: se cancela'
      USING ERRCODE = '42501', HINT = 'Cancélala (status cancelled) en vez de borrarla';
  END IF;
  RETURN OLD;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_borrado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_borrado() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_borrado() IS
  'Agenda v2: con agenda_ajustes.agenda_v2_encendida, una cita con paciente o por ligar (reserva_canal no nulo) no se borra: se cancela. Lee sólo OLD y agenda_ajustes, nunca appointments. postgres y supabase_admin quedan fuera (editor SQL, acciones referenciales); service_role, no.';

-- 2.5 · El cierre de una cancelada: sólo service_role, sólo sobre una
--       cancelada que sigue cancelada; nadie nace cerrada y no se reabre.
CREATE OR REPLACE FUNCTION public.cita_proteger_cierre()
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
    IF NEW.cerrada_en IS NOT NULL OR NEW.sustituida_por IS NOT NULL THEN
      RAISE EXCEPTION 'Una cita no nace cerrada' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- Ya cerrada: no se reabre ni cambia (ni se le pone) sustituta.
  IF OLD.cerrada_en IS NOT NULL THEN
    IF (NEW.status, NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.status, OLD.cerrada_en, OLD.sustituida_por) THEN
      RAISE EXCEPTION 'Una cita cancelada que ya se cerró no se reabre'
        USING ERRCODE = '42501', HINT = 'Se sustituyó por otra cita o se quitó de la agenda; se conserva como cancelada';
    END IF;
    RETURN NEW;
  END IF;
  -- Abierta: cerrar sólo el servidor, sólo una cancelada que sigue cancelada. Sin sustituta
  -- («Eliminar cita») o con una sustituta VIVA (ni cancelada ni cerrada: sin cadenas ni
  -- pares que se escondan entre sí) de la misma clínica.
  IF (NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.cerrada_en, OLD.sustituida_por) THEN
    IF current_user <> 'service_role' OR OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status IS DISTINCT FROM 'cancelled'
       OR NEW.cerrada_en IS NULL
       OR (NEW.sustituida_por IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.appointments s
                            WHERE s.id = NEW.sustituida_por AND s.id <> NEW.id AND s.clinica_id = NEW.clinica_id
                              AND s.status IS DISTINCT FROM 'cancelled' AND s.cerrada_en IS NULL)) THEN
      RAISE EXCEPTION 'Sólo el servidor cierra una cita cancelada, sin sustituta o con una sustituta viva de la misma clínica'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_cierre() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_cierre() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_cierre() IS
  'Agenda v2: cerrada_en/sustituida_por de appointments sólo los pone service_role, sólo sobre una cancelada que sigue cancelada; sin sustituta («Eliminar cita») o con una sustituta viva de la misma clínica; ninguna cita nace cerrada y una cerrada no se reabre (ni estado ni cierre ni sustituta). 42501. postgres y supabase_admin quedan fuera.';

-- 2.6 · La reservada por enlace que no ha empezado: el médico nunca cambia; el
--       consultorio, el inicio y todo el día, sólo con «Reagendar»
--       (cita_reagendar_clinica de F4: service_role + GUC spinus.reagendar_cita =
--       id de la cita). La duración (end_time) es libre.
CREATE OR REPLACE FUNCTION public.cita_proteger_eleccion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR OLD.reserva_canal IS NULL OR OLD.start_time <= now()
     OR (NEW.medico_id, NEW.consultorio_id, NEW.start_time, NEW.all_day)
        IS NOT DISTINCT FROM (OLD.medico_id, OLD.consultorio_id, OLD.start_time, OLD.all_day)
     OR NOT public.agenda_v2_encendida(OLD.clinica_id) THEN
    RETURN NEW;  -- la duración (end_time) es libre
  END IF;
  IF NEW.medico_id IS DISTINCT FROM OLD.medico_id THEN
    RAISE EXCEPTION 'El médico de una cita reservada por enlace no se cambia'
      USING ERRCODE = '42501', HINT = 'Si la atenderá otro médico, cancélala y reserva con él';
  END IF;
  -- coalesce: una GUC que la sesión nunca puso vale NULL, y NOT (true AND NULL)
  -- es NULL, que el IF toma como falso: sin él, service_role pasaría sin ella.
  IF NOT (current_user = 'service_role' AND coalesce(current_setting('spinus.reagendar_cita', true), '') = OLD.id::text) THEN
    RAISE EXCEPTION 'El consultorio, el día y la hora de una cita reservada por enlace sólo cambian con «Reagendar»'
      USING ERRCODE = '42501', HINT = 'Reagendar avisa al paciente con los datos nuevos';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_eleccion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_eleccion() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_eleccion() IS
  'Agenda: en una cita reservada por enlace (reserva_canal) que no ha empezado y con agenda_v2_encendida, el médico no cambia nunca y el consultorio, el inicio y todo el día sólo cambian por cita_reagendar_clinica (service_role + GUC spinus.reagendar_cita = id de la cita); el fin (la duración) es libre. 42501. Vale también después de ligar la cita a un paciente. Lee OLD/NEW y agenda_ajustes; nunca appointments. postgres y supabase_admin quedan fuera; service_role, no (la sincronización con Google rechaza el cambio y restablece el evento).';

-- 2.7 · Las columnas reserva_* sólo las escribe el servidor.
--       Las lista POR PREFIJO desde la fila: toda columna nueva reserva_* queda
--       cerrada sola, y si naciera con DEFAULT rompería el alta con la sesión
--       (dale otro nombre o añade la excepción aquí).
CREATE OR REPLACE FUNCTION public.cita_proteger_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_columna text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT n.key INTO v_columna FROM jsonb_each(to_jsonb(NEW)) n
     WHERE n.key LIKE 'reserva\_%'
       AND n.value IS DISTINCT FROM (CASE WHEN n.key = 'reserva_reagendados' THEN '0' ELSE 'null' END)::jsonb
     ORDER BY n.key LIMIT 1;
  ELSE
    SELECT n.key INTO v_columna FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
     WHERE n.key LIKE 'reserva\_%'
       AND n.value IS DISTINCT FROM o.value
       AND NOT (n.key IN ('reserva_telefono', 'reserva_correo') AND n.value = 'null'::jsonb)
     ORDER BY n.key LIMIT 1;
  END IF;
  IF v_columna IS NOT NULL THEN
    RAISE EXCEPTION 'La columna % de la cita sólo la escribe el servidor', v_columna
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_reserva() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_reserva() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.cita_proteger_reserva() IS
  'Agenda v2: las columnas reserva_* de appointments sólo las escribe el servidor (service_role: reservar_por_enlace, reagendar_por_enlace; o postgres/supabase_admin). La sesión no las pone al crear (todas NULL, reserva_reagendados 0) ni las cambia al editar, salvo vaciar reserva_telefono/reserva_correo (supresión a petición del titular). CONVENIO: toda columna nueva con prefijo reserva_ queda cerrada sola (se listan desde la fila).';

-- ---------------------------------------------------------------------
-- 3 · Índices de rango de la agenda (SHARE: desde aquí las escrituras de
--     citas esperan hasta el COMMIT; las lecturas, no).
--     end_time va en la llave para que el solape se compruebe en el índice y
--     no en el heap. No reordenar las columnas sin volver a medir.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appointments_clinica_inicio
  ON public.appointments USING btree (clinica_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_clinica_medico_inicio
  ON public.appointments USING btree (clinica_id, medico_id, start_time, end_time);
COMMENT ON INDEX public.idx_appointments_clinica_inicio IS
  'Ventana de la agenda: clinica_id = ? AND start_time < hasta AND end_time >= desde ORDER BY start_time (GET /api/appointments). end_time va en la llave para que el solape se compruebe en el índice y no en el heap. Medido en supabase/auditorias/A1.8-indices-rango-agenda.md; no reordenar las columnas sin volver a medir.';
COMMENT ON INDEX public.idx_appointments_clinica_medico_inicio IS
  'Ventana de la agenda filtrada por médico: clinica_id = ? AND medico_id = ? AND start_time < hasta AND end_time >= desde ORDER BY start_time. Medido en supabase/auditorias/A1.8-indices-rango-agenda.md.';

-- ---------------------------------------------------------------------
-- 4 · Los disparadores que no nombran las columnas nuevas (SHARE ROW
--     EXCLUSIVE: tampoco frenan las lecturas). Los filtros UPDATE OF y WHEN
--     ahorran llamadas: los ecos de Google sólo tocan gcal_* y no despiertan a
--     ninguno salvo proteger_reserva (que mira todas las columnas y exime a
--     service_role). El del cierre va en el paso 6, tras sus columnas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_appointments_horario_bloqueado
  BEFORE INSERT OR UPDATE OF start_time, end_time, medico_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_bloqueo();

CREATE OR REPLACE TRIGGER trg_appointments_proteger_atendida
  BEFORE UPDATE OF status, start_time, end_time, all_day OR DELETE ON public.appointments
  FOR EACH ROW WHEN (OLD.status = 'attended')
  EXECUTE FUNCTION public.cita_proteger_atendida();

CREATE OR REPLACE TRIGGER trg_appointments_proteger_borrado
  BEFORE DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_borrado();

CREATE OR REPLACE TRIGGER trg_appointments_proteger_eleccion
  BEFORE UPDATE OF medico_id, consultorio_id, start_time, end_time, all_day ON public.appointments
  FOR EACH ROW WHEN (OLD.reserva_canal IS NOT NULL)
  EXECUTE FUNCTION public.cita_proteger_eleccion();

CREATE OR REPLACE TRIGGER trg_appointments_proteger_reserva
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_reserva();

-- ---------------------------------------------------------------------
-- 5 · La cancelada cerrada: columnas, FK, CHECK, índice y comentarios, en
--     UN bloque. El ADD COLUMN toma ACCESS EXCLUSIVE (frena también las
--     lecturas) hasta el COMMIT: por eso va aquí, al final y de una vez.
--     Cerrada CON sustituta = se le dio otra cita; SIN sustituta = «Eliminar
--     cita». Las dos se ocultan igual y ninguna se reabre desde la app.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS cerrada_en timestamptz,
    ADD COLUMN IF NOT EXISTS sustituida_por uuid;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_sustituida_por_fkey') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_sustituida_por_fkey
      FOREIGN KEY (sustituida_por) REFERENCES public.appointments (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_cierre_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_cierre_check CHECK (
      (cerrada_en IS NULL AND sustituida_por IS NULL)
      OR (cerrada_en IS NOT NULL AND status = 'cancelled' AND (sustituida_por IS NULL OR sustituida_por <> id)));
  END IF;
  -- La FK RESTRICT (borrar una sustituta busca aquí) y «¿quién sustituyó a quién?».
  CREATE INDEX IF NOT EXISTS idx_appointments_sustituida_por
    ON public.appointments (sustituida_por) WHERE sustituida_por IS NOT NULL;
  COMMENT ON COLUMN public.appointments.cerrada_en IS
    'Agenda v2: cuándo esta cita CANCELADA dejó la agenda. Con sustituta (sustituida_por): se le dio otra cita o se reasignó su horario. Sin sustituta: se quitó con «Eliminar cita». No nula = cerrada: no se pinta, no se reabre y sigue contando para el candado. La escribe sólo el servidor (service_role, cita_proteger_cierre).';
  COMMENT ON COLUMN public.appointments.sustituida_por IS
    'Agenda v2: la cita que sustituyó a esta cancelada (misma clínica). FK RESTRICT: la sustituta no se borra mientras ésta la señale. La escribe sólo el servidor, junto con cerrada_en.';
END $$;

-- ---------------------------------------------------------------------
-- 6 · El disparador del cierre (nombra cerrada_en y sustituida_por).
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_appointments_proteger_cierre
  BEFORE INSERT OR UPDATE OF status, cerrada_en, sustituida_por ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_cierre();

-- ---------------------------------------------------------------------
-- 7 · Post-vuelo. Si algo no quedó como se quiere, se deshace TODO.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_n integer;
BEGIN
  -- Las seis funciones de disparador: INVOKER, de postgres, search_path vacío, sin PUBLIC, con los tres roles.
  SELECT count(*) INTO v_n FROM pg_catalog.pg_proc p
   WHERE p.oid IN (to_regprocedure('public.cita_proteger_bloqueo()'), to_regprocedure('public.cita_proteger_atendida()'),
                   to_regprocedure('public.cita_proteger_borrado()'), to_regprocedure('public.cita_proteger_cierre()'),
                   to_regprocedure('public.cita_proteger_eleccion()'), to_regprocedure('public.cita_proteger_reserva()'))
     AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""'] AND p.prorettype = 'trigger'::regtype
     AND pg_get_userbyid(p.proowner) = 'postgres'
     AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0)
     AND has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: sólo % de las 6 cita_proteger_*() son INVOKER, de postgres, con search_path vacío y los permisos esperados.', v_n;
  END IF;
  -- cita_tiene_nota_ligada: DEFINER de postgres, search_path vacío, sin PUBLIC ni anon.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid = 'public.cita_tiene_nota_ligada(uuid, uuid)'::regprocedure
                  AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
                  AND pg_get_userbyid(p.proowner) = 'postgres'
                  AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0)
                  AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
                  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: cita_tiene_nota_ligada no es DEFINER de postgres con search_path vacío, o la ejecuta PUBLIC/anon.';
  END IF;
  -- Los seis disparadores, activos y sobre su función.
  SELECT count(*) INTO v_n FROM pg_catalog.pg_trigger t
   WHERE t.tgrelid = 'public.appointments'::regclass AND NOT t.tgisinternal AND t.tgenabled = 'O'
     AND (t.tgname, t.tgfoid) IN (
       ('trg_appointments_horario_bloqueado', 'public.cita_proteger_bloqueo()'::regprocedure),
       ('trg_appointments_proteger_atendida', 'public.cita_proteger_atendida()'::regprocedure),
       ('trg_appointments_proteger_borrado', 'public.cita_proteger_borrado()'::regprocedure),
       ('trg_appointments_proteger_cierre', 'public.cita_proteger_cierre()'::regprocedure),
       ('trg_appointments_proteger_eleccion', 'public.cita_proteger_eleccion()'::regprocedure),
       ('trg_appointments_proteger_reserva', 'public.cita_proteger_reserva()'::regprocedure));
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: sólo % de los 6 disparadores de protección están activos sobre su función.', v_n;
  END IF;
  -- Las columnas nuevas no dan a nadie más de lo que ya da la tabla (sin GRANT por columna).
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass
              AND attname IN ('cerrada_en', 'sustituida_por') AND attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: cerrada_en o sustituida_por tienen permisos propios.';
  END IF;
  -- Los tres índices de F5b y la llave primaria (la usa la FK), válidos.
  IF (SELECT count(*) FROM pg_catalog.pg_index i
       WHERE i.indrelid = 'public.appointments'::regclass AND i.indisvalid AND i.indisready
         AND (i.indisprimary OR i.indexrelid IN (to_regclass('public.idx_appointments_clinica_inicio'),
                                                 to_regclass('public.idx_appointments_clinica_medico_inicio'),
                                                 to_regclass('public.idx_appointments_sustituida_por')))) <> 4 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: falta alguno de los tres índices de F5b o la llave primaria de appointments, o no es válido.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 8 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparadores BEFORE de appointments (por orden de disparo)' AS comprobacion,
         (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_catalog.pg_trigger
           WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal AND tgenabled = 'O'
             AND (tgtype & 2) = 2 AND (tgtype & 1) = 1) AS valor,
         'trg_appointments_asignacion_google,trg_appointments_horario_bloqueado,trg_appointments_proteger_atendida,trg_appointments_proteger_borrado,trg_appointments_proteger_cierre,trg_appointments_proteger_eleccion,trg_appointments_proteger_reserva' AS esperado
  UNION ALL
  SELECT 2, 'cita_proteger_*(): INVOKER (las 6)',
         (SELECT count(*)::text FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace
           AND proname IN ('cita_proteger_bloqueo', 'cita_proteger_atendida', 'cita_proteger_borrado',
                           'cita_proteger_cierre', 'cita_proteger_eleccion', 'cita_proteger_reserva') AND NOT prosecdef),
         '6'
  UNION ALL
  SELECT 3, 'cita_tiene_nota_ligada: DEFINER / anon / PUBLIC',
         coalesce((SELECT prosecdef::text || ' / ' || has_function_privilege('anon', oid, 'EXECUTE')::text || ' / '
                          || EXISTS (SELECT 1 FROM aclexplode(proacl) x WHERE x.grantee = 0)::text
                     FROM pg_catalog.pg_proc WHERE oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')), 'AUSENTE'),
         'true / false / false'
  UNION ALL
  SELECT 4, 'appointments_cierre_check',
         coalesce(pg_get_constraintdef((SELECT oid FROM pg_catalog.pg_constraint WHERE conrelid = 'public.appointments'::regclass
                                          AND conname = 'appointments_cierre_check')), 'AUSENTE'),
         'CHECK ((((cerrada_en IS NULL) AND (sustituida_por IS NULL)) OR ((cerrada_en IS NOT NULL) AND (status = ''cancelled''::text) AND ((sustituida_por IS NULL) OR (sustituida_por <> id)))))'
  UNION ALL
  SELECT 5, 'appointments_sustituida_por_fkey (por catálogo: tabla referida / columnas / ON DELETE)',
         coalesce((SELECT rn.nspname || '.' || r.relname || '(' || array_to_string(ARRAY(
                            SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(attnum, n)
                              JOIN pg_catalog.pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum ORDER BY k.n), ',')
                          || ') ← ' || array_to_string(ARRAY(
                            SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(attnum, n)
                              JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum ORDER BY k.n), ',')
                          || ' / ' || c.confdeltype::text
                     FROM pg_catalog.pg_constraint c
                     JOIN pg_catalog.pg_class r ON r.oid = c.confrelid
                     JOIN pg_catalog.pg_namespace rn ON rn.oid = r.relnamespace
                    WHERE c.conrelid = 'public.appointments'::regclass
                      AND c.conname = 'appointments_sustituida_por_fkey' AND c.contype = 'f'),
                  'AUSENTE'),
         'public.appointments(id) ← sustituida_por / r'
  UNION ALL
  SELECT 6, 'índices de F5b, válidos',
         (SELECT count(*)::text FROM pg_catalog.pg_index WHERE indisvalid AND indisready AND indexrelid IN (
            to_regclass('public.idx_appointments_clinica_inicio'), to_regclass('public.idx_appointments_clinica_medico_inicio'),
            to_regclass('public.idx_appointments_sustituida_por'))),
         '3'
  UNION ALL
  SELECT 7, 'llave primaria de appointments válida (la usa la FK)',
         coalesce((SELECT (indisvalid AND indisready)::text FROM pg_catalog.pg_index
                    WHERE indrelid = 'public.appointments'::regclass AND indisprimary), 'AUSENTE'),
         'true'
) t
ORDER BY t.n;
