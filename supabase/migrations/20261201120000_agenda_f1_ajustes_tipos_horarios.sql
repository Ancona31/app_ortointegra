-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F1 — ajustes e interruptor, tipos de cita, horarios de
-- consultorio, auditoría de citas y «Restablecer»
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE
--   · agenda_ajustes (15 columnas), su RLS, su protección y su auditoría.
--   · agenda_v2_encendida(uuid): la ÚNICA lectura común del interruptor.
--   · tipos_cita (con la duración de la consulta: principal y consultorio_id),
--     su RLS y sus disparadores; appointments.tipo_cita_id / tipo_cita_nombre
--     con la FK compuesta y el CHECK de la instantánea.
--   · log_cita_change() y los disparadores audit_appointments(_update).
--   · consultorios.horario_propio y horario_revisado_en; clinicas.timezone.
--   · EL ÚNICO BACKFILL DEL CONJUNTO: cada consultorio hereda UNA vez el
--     horario de su clínica, con respaldo previo en
--     respaldos.consultorios_horario_20261119.
--   · agenda_restablecer_configuracion(uuid, uuid).
-- DEPENDE DE
--   · orden: va PRIMERO del conjunto; no necesita ningún otro bloque.
--     agenda_restablecer_configuracion toca reserva_enlaces (F3) sólo al
--     ejecutarse (plpgsql).
--   · main: appointments, audit_log, clinicas, consultorios, profiles;
--     get_clinica_id(), soy_admin_de_clinica(), get_my_role() (SECURITY
--     DEFINER), log_tabla_change(), auth.uid(); el esquema respaldos.
--   · PostgreSQL ≥ 13 (gen_random_uuid() del núcleo); producción es 17.6.
--   · Ser dueño (o miembro del dueño) de appointments, clinicas, consultorios y
--     profiles: se aplica como postgres, con psql -X -v ON_ERROR_STOP=1
--     (supabase/produccion/plan/aplicar.sh). No depende del search_path de la
--     sesión: todo va calificado y la rejilla no imprime nombres con regclass.
-- RIESGO: MEDIO. Toca la tabla más escrita de la agenda y reescribe valores
--   de consultorios (con respaldo). El horario EFECTIVO de cada consultorio no
--   cambia: con horario_propio = false valía el de la clínica, y es lo que se
--   copia. Ningún dato de pacientes se escribe.
--   · Bloqueos. Todo es UNA transacción: cada candado se sostiene hasta el
--     COMMIT. Los fuertes se piden juntos, en dos tiempos, con NOWAIT y
--     reintentos (50 × 0,1 s): la migración nunca hace cola —una cola sobre
--     appointments o clinicas frenaría a toda la app que llega detrás—; si
--     no los consigue en 5 s, aborta sin cambiar nada y se reintenta más
--     tarde (lo dice el error).
--       1) §2: SHARE ROW EXCLUSIVE sobre clinicas, profiles y consultorios (los
--          que toman las FK de agenda_ajustes y tipos_cita). Frena sus
--          ESCRITURAS, no sus lecturas, durante lo que tarden las tablas,
--          funciones y policies nuevas.
--       2) §10: ACCESS EXCLUSIVE sobre appointments, consultorios y clinicas
--          (ADD COLUMN, la FK y el CHECK de appointments con su comprobación,
--          el índice, los CREATE TRIGGER, el backfill). Frena lecturas y
--          escrituras; clinicas la leen las funciones de la RLS, así que
--          frena casi toda la app. Por eso todo lo que exige este candado va
--          en UN solo bloque DO (un viaje al servidor, no uno por sentencia)
--          al final: desde que se toma hasta el COMMIT sólo hay ese bloque,
--          el post-vuelo y el COMMIT (tres viajes por el pooler).
--     Las columnas nuevas no reescriben ninguna tabla (sin DEFAULT o con
--     DEFAULT constante); la FK y el CHECK recorren appointments una vez (las
--     columnas nacen NULL, no puede fallar). NOT VALID + VALIDATE aparte no
--     acortaría nada dentro de la misma transacción, y en otra dejaría la
--     restricción a medias si fallara.
--   · Duración (clon de la foto, sin datos): ver la nota de F1. Aplicar
--     cuando no haya consulta.
--   · Si falla en cualquier punto, se deshace TODO (no queda nada a medias).
-- SEGUNDA PASADA: ABORTA LIMPIO en el pre-vuelo, antes de pedir ningún
--   candado, si ya existe cualquier objeto de este bloque (salvo el respaldo,
--   que se reutiliza si tiene su forma).
-- CÓMO SE DESHACE: supabase/reversas/20261201120000_agenda_f1_ajustes_
--   tipos_horarios_reversa.sql, DESPUÉS de las reversas de los bloques
--   posteriores. Devuelve el horario previo a los consultorios cuyo horario
--   nadie editó desde la copia (aunque se editara otro campo) y conserva el
--   respaldo; aplicar → revertir → reaplicar → revertir funciona cada vez; se niega si hay datos de la
--   v2 que se perderían, salvo confirmación explícita.
-- El veredicto es la rejilla del final (OK / INFO / REVISAR).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear o escribir nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tabla text;
  v_ya    text[];
  v_n     integer;
BEGIN
  -- 1.1 Lo de main de lo que dependemos.
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.audit_log', 'public.clinicas',
                                 'public.consultorios', 'public.profiles'] LOOP
    IF to_regclass(v_tabla) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe %.', v_tabla;
    END IF;
  END LOOP;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id(), soy_admin_de_clinica(), get_my_role(), log_tabla_change() o auth.uid().';
  END IF;
  -- Las policies de este archivo sólo llaman a estos helpers, que leen
  -- profiles: tienen que ser SECURITY DEFINER o habría recursión de RLS.
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: get_clinica_id(), soy_admin_de_clinica() o get_my_role() ya no es SECURITY DEFINER.';
  END IF;
  -- Las columnas de main que leen o escriben los objetos de este archivo.
  IF (SELECT count(*) FROM pg_attribute
       WHERE attnum > 0 AND NOT attisdropped
         AND (attrelid, attname, atttypid) IN (
           ('public.appointments'::regclass, 'id', 'uuid'::regtype),
           ('public.appointments'::regclass, 'clinica_id', 'uuid'::regtype),
           ('public.appointments'::regclass, 'status', 'text'::regtype),
           ('public.appointments'::regclass, 'paciente_id', 'uuid'::regtype),
           ('public.appointments'::regclass, 'origen', 'text'::regtype),
           ('public.audit_log'::regclass, 'user_id', 'text'::regtype),
           ('public.audit_log'::regclass, 'accion', 'text'::regtype),
           ('public.audit_log'::regclass, 'tabla', 'text'::regtype),
           ('public.audit_log'::regclass, 'registro_id', 'uuid'::regtype),
           ('public.audit_log'::regclass, 'descripcion', 'text'::regtype),
           ('public.clinicas'::regclass, 'id', 'uuid'::regtype),
           ('public.consultorios'::regclass, 'id', 'uuid'::regtype),
           ('public.consultorios'::regclass, 'medico_id', 'uuid'::regtype),
           ('public.consultorios'::regclass, 'es_default', 'boolean'::regtype),
           ('public.consultorios'::regclass, 'activo', 'boolean'::regtype),
           ('public.profiles'::regclass, 'role', 'text'::regtype),
           ('public.profiles'::regclass, 'clinica_id', 'uuid'::regtype),
           ('public.profiles'::regclass, 'es_admin_de_clinica', 'boolean'::regtype))) <> 18 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a appointments, audit_log, clinicas, consultorios o profiles les falta una columna esperada (o cambió de tipo).';
  END IF;
  -- El backfill copia jsonb NOT NULL en jsonb NOT NULL.
  IF (SELECT count(*) FROM pg_attribute
       WHERE NOT attisdropped AND attnotnull
         AND (attrelid, attname, atttypid) IN (('public.consultorios'::regclass, 'horario', 'jsonb'::regtype),
                                               ('public.clinicas'::regclass, 'horario_consulta', 'jsonb'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: consultorios.horario o clinicas.horario_consulta no son jsonb NOT NULL.';
  END IF;

  -- 1.2 Propiedad: ADD COLUMN, FK y CREATE TRIGGER lo exigen.
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments', 'public.clinicas', 'public.consultorios', 'public.profiles'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de % (lo es %).',
        current_user, v_tabla, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass));
    END IF;
  END LOOP;

  -- 1.3 Otro disparador de auditoría en appointments duplicaría cada fila.
  IF EXISTS (SELECT 1 FROM pg_trigger t
              WHERE t.tgrelid = 'public.appointments'::regclass AND NOT t.tgisinternal
                AND t.tgfoid = to_regprocedure('public.log_tabla_change()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments ya tiene un disparador con log_tabla_change(); revisar antes.';
  END IF;

  -- 1.4 Segunda pasada: nada de este bloque puede existir ya. Este archivo no
  --     se re-ejecuta: aborta aquí, antes de tocar nada.
  SELECT array_agg(o) INTO v_ya FROM (
    SELECT 'public.agenda_ajustes' AS o WHERE to_regclass('public.agenda_ajustes') IS NOT NULL
    UNION ALL SELECT 'public.tipos_cita' WHERE to_regclass('public.tipos_cita') IS NOT NULL
    UNION ALL SELECT p.oid::regprocedure::text FROM pg_proc p
               WHERE p.pronamespace = 'public'::regnamespace
                 AND p.proname IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico',
                                   'validar_tipo_cita_consultorio', 'update_tipos_cita_updated_at',
                                   'log_cita_change', 'agenda_restablecer_configuracion')
    UNION ALL SELECT 'trigger ' || t.tgname FROM pg_trigger t
               WHERE t.tgrelid = 'public.appointments'::regclass
                 AND t.tgname IN ('audit_appointments', 'audit_appointments_update')
    UNION ALL SELECT a.attrelid::regclass::text || '.' || a.attname FROM pg_attribute a
               WHERE NOT a.attisdropped
                 AND (a.attrelid, a.attname) IN (('public.appointments'::regclass, 'tipo_cita_id'),
                                                 ('public.appointments'::regclass, 'tipo_cita_nombre'),
                                                 ('public.consultorios'::regclass, 'horario_propio'),
                                                 ('public.consultorios'::regclass, 'horario_revisado_en'),
                                                 ('public.clinicas'::regclass, 'timezone'))
    UNION ALL SELECT 'index ' || c.relname FROM pg_class c
               WHERE c.oid = to_regclass('public.idx_appointments_tipo_cita')
  ) x;
  IF v_ya IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: este bloque (F1) ya está aplicado o a medias; existen: %. No se toca nada.', v_ya;
  END IF;

  -- 1.5 El respaldo: el esquema tiene que existir; la tabla, si ya existe (un
  --     reintento tras la reversa, que la conserva), tiene que ser ésta.
  IF to_regnamespace('respaldos') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe el esquema respaldos (créalo antes: CREATE SCHEMA respaldos;).';
  END IF;
  IF to_regclass('respaldos.consultorios_horario_20261119') IS NOT NULL
     AND (SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attnum) FROM pg_attribute
           WHERE attrelid = to_regclass('respaldos.consultorios_horario_20261119') AND attnum > 0 AND NOT attisdropped)
         <> 'id:uuid,clinica_id:uuid,horario:jsonb,horario_propio:boolean,respaldado_en:timestamp with time zone,'
            'horario_antes:jsonb,horario_copiado:jsonb,copiado_en:timestamp with time zone' THEN
    -- Una base que aplicó la F1 de antes de la ronda 1 de la auditoría (A4) lo
    -- tiene sin horario_antes/horario_copiado/copiado_en: se completa a mano.
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: respaldos.consultorios_horario_20261119 ya existe con otra forma. No se toca.';
  END IF;

  -- 1.6 El backfill. horario_propio nace en false en TODOS los consultorios, así
  --     que el UPDATE toca a todos los médicos con consultorio, y el disparador
  --     de existencia del predeterminado (enforce_consultorio_default_existencia)
  --     revisa a cada uno: si alguno tiene consultorios activos y ninguno
  --     predeterminado, el UPDATE abortaría a medias del archivo. Se cuenta aquí.
  SELECT count(*) INTO v_n FROM (
    SELECT medico_id FROM public.consultorios
     GROUP BY medico_id
    HAVING count(*) FILTER (WHERE activo) >= 1 AND count(*) FILTER (WHERE activo AND es_default) = 0) m;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % médico(s) con consultorios activos y ninguno predeterminado; enforce_consultorio_default_existencia abortaría la copia de horarios. Corrígelo antes.', v_n;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Candados, primer tiempo: SHARE ROW EXCLUSIVE sobre clinicas, profiles
--     y consultorios, los que pedirían las FK de agenda_ajustes y tipos_cita.
--     NOWAIT: no entra en la cola de candados (nunca frena a quien llega
--     detrás). 50 intentos cada 0,1 s; un intento fallido se deshace entero
--     (subtransacción), así que no se queda con la mitad.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  FOR i IN 1..50 LOOP
    BEGIN
      LOCK TABLE public.clinicas, public.profiles, public.consultorios IN SHARE ROW EXCLUSIVE MODE NOWAIT;
      RETURN;
    EXCEPTION WHEN lock_not_available THEN
      PERFORM pg_sleep(0.1);
    END;
  END LOOP;
  RAISE EXCEPTION 'CANDADOS: clinicas, profiles o consultorios siguieron ocupadas 5 s (una transacción larga las escribe). No se cambió nada: reintenta en unos minutos.'
    USING ERRCODE = '55P03';
END $$;

-- ---------------------------------------------------------------------
-- 3 · agenda_ajustes: ajustes por clínica, candado e interruptor.
--     Sin fila = valores de fábrica e interruptor apagado (el código cae ahí
--     ante cualquier error): por eso no hay backfill de esta tabla.
--     Tabla propia y no columnas en clinicas: allí el prefijo ajuste_* es
--     contrato con spinus-consola.
-- ---------------------------------------------------------------------
CREATE TABLE public.agenda_ajustes (
  id                         uuid        NOT NULL DEFAULT gen_random_uuid(),  -- log_tabla_change() escribe NEW.id
  clinica_id                 uuid        NOT NULL,
  recordatorio_horas         integer     NOT NULL DEFAULT 24,
  anticipacion_min_horas     integer     NOT NULL DEFAULT 2,
  horizonte_dias             integer     NOT NULL DEFAULT 60,
  vigencia_enlace_unico_dias integer     NOT NULL DEFAULT 7,
  -- ⚠️ Los DEFAULT de los cuatro candado_* están repetidos en
  -- proteger_agenda_ajustes(): van juntos.
  candado_citas_activas      integer     NOT NULL DEFAULT 1,
  candado_reagendados        integer     NOT NULL DEFAULT 2,
  candado_cancelaciones      integer     NOT NULL DEFAULT 3,
  candado_ventana_dias       integer     NOT NULL DEFAULT 60,
  agenda_v2_encendida        boolean     NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  recordatorio_encendido     boolean     NOT NULL DEFAULT false,
  correo_reserva_clinica     boolean     NOT NULL DEFAULT false,
  CONSTRAINT agenda_ajustes_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_ajustes_clinica_key UNIQUE (clinica_id),
  CONSTRAINT agenda_ajustes_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_ajustes_recordatorio_rango CHECK (recordatorio_horas BETWEEN 1 AND 72),
  CONSTRAINT agenda_ajustes_anticipacion_rango CHECK (anticipacion_min_horas BETWEEN 0 AND 72),
  CONSTRAINT agenda_ajustes_horizonte_rango    CHECK (horizonte_dias BETWEEN 1 AND 365),
  CONSTRAINT agenda_ajustes_vigencia_rango     CHECK (vigencia_enlace_unico_dias BETWEEN 1 AND 30),
  CONSTRAINT agenda_ajustes_candado_rango      CHECK (candado_citas_activas >= 1 AND candado_reagendados >= 0
                                                      AND candado_cancelaciones >= 1 AND candado_ventana_dias >= 1)
);

ALTER TABLE public.agenda_ajustes ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan casi todo a los tres roles.
REVOKE ALL ON TABLE public.agenda_ajustes FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.agenda_ajustes FROM authenticated;
REVOKE TRUNCATE ON TABLE public.agenda_ajustes FROM service_role;

-- Sin recursión: las policies sólo llaman a helpers SECURITY DEFINER que leen
-- profiles, nunca a agenda_ajustes. Sin policy de DELETE.
CREATE POLICY agenda_ajustes_select ON public.agenda_ajustes FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id());
CREATE POLICY agenda_ajustes_insert ON public.agenda_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());
CREATE POLICY agenda_ajustes_update ON public.agenda_ajustes FOR UPDATE TO authenticated
  USING (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id())
  WITH CHECK (public.soy_admin_de_clinica() AND clinica_id = public.get_clinica_id());

-- Sólo postgres/supabase_admin cambian el interruptor, el candado y la
-- identidad de la fila (tampoco service_role). ⚠️ INVOKER a propósito: decide
-- por current_user. Una función SECURITY DEFINER de postgres que escribiera en
-- agenda_ajustes se saltaría esta protección.
CREATE FUNCTION public.proteger_agenda_ajustes()
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
  -- ⚠️ (1, 2, 3, 60) son los DEFAULT de los candado_* de la tabla. Van juntos.
  IF TG_OP = 'INSERT' THEN
    IF NEW.agenda_v2_encendida
       OR (NEW.candado_citas_activas, NEW.candado_reagendados, NEW.candado_cancelaciones, NEW.candado_ventana_dias)
          IS DISTINCT FROM (1, 2, 3, 60) THEN
      RAISE EXCEPTION 'El interruptor y el candado de la agenda sólo se cambian desde el editor SQL'
        USING ERRCODE = '42501';
    END IF;
  ELSIF (NEW.id, NEW.clinica_id, NEW.created_at, NEW.agenda_v2_encendida, NEW.candado_citas_activas,
         NEW.candado_reagendados, NEW.candado_cancelaciones, NEW.candado_ventana_dias)
        IS DISTINCT FROM
        (OLD.id, OLD.clinica_id, OLD.created_at, OLD.agenda_v2_encendida, OLD.candado_citas_activas,
         OLD.candado_reagendados, OLD.candado_cancelaciones, OLD.candado_ventana_dias) THEN
    RAISE EXCEPTION 'El interruptor y el candado de la agenda sólo se cambian desde el editor SQL'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;

-- Función de disparador: EXECUTE a los tres roles (regla del proyecto); no se
-- puede llamar como RPC.
REVOKE EXECUTE ON FUNCTION public.proteger_agenda_ajustes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_agenda_ajustes() TO anon, authenticated, service_role;

CREATE TRIGGER trg_agenda_ajustes_proteger
  BEFORE INSERT OR UPDATE ON public.agenda_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_agenda_ajustes();

CREATE TRIGGER audit_agenda_ajustes
  AFTER INSERT OR UPDATE OR DELETE ON public.agenda_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 4 · La lectura común del interruptor. Los demás bloques la llaman.
--     ⚠️ INVOKER a propósito: dentro de un disparador INVOKER lee con la RLS
--     de la sesión (agenda_ajustes_select: sólo la clínica propia), y dentro
--     de una función DEFINER lee como su dueño, igual que una lectura en línea. Hacerla DEFINER dejaría a cualquier sesión preguntar por
--     el interruptor de otra clínica.
--     Sin fila = false: falla cerrado.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.agenda_v2_encendida(p_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce((SELECT a.agenda_v2_encendida FROM public.agenda_ajustes a
                    WHERE a.clinica_id = p_clinica_id), false)
$fn$;

-- authenticated: los disparadores INVOKER de appointments corren con la sesión.
-- service_role: las RPC del servidor. anon NO: ningún camino de anon llega a
-- leer el interruptor (anon no tiene privilegio sobre agenda_ajustes, y su
-- INSERT en appointments choca antes con la RLS de agenda_bloqueos).
REVOKE EXECUTE ON FUNCTION public.agenda_v2_encendida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_v2_encendida(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5 · tipos_cita. medico_id NULL = de toda la clínica; con valor = sólo de
--     ese médico. Se archivan, nunca se borran (sin DELETE para la sesión).
--     La duración de la consulta de un médico ES un tipo suyo con
--     principal = true; la de un consultorio, otro principal con
--     consultorio_id. Así reservar_por_enlace calcula el fin con la duración
--     del tipo sin mirar otra tabla.
-- ---------------------------------------------------------------------
CREATE TABLE public.tipos_cita (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id     uuid        NOT NULL,
  medico_id      uuid,
  nombre         text        NOT NULL,
  duracion_min   integer     NOT NULL,
  color          text,
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  consultorio_id uuid,
  principal      boolean     NOT NULL DEFAULT false,
  CONSTRAINT tipos_cita_pkey PRIMARY KEY (id),
  -- La llave de la FK compuesta desde appointments.
  CONSTRAINT tipos_cita_id_clinica_key UNIQUE (id, clinica_id),
  CONSTRAINT tipos_cita_clinica_id_fkey     FOREIGN KEY (clinica_id)     REFERENCES public.clinicas(id)     ON DELETE RESTRICT,
  CONSTRAINT tipos_cita_medico_id_fkey      FOREIGN KEY (medico_id)      REFERENCES public.profiles(id)     ON DELETE RESTRICT,
  CONSTRAINT tipos_cita_consultorio_id_fkey FOREIGN KEY (consultorio_id) REFERENCES public.consultorios(id) ON DELETE RESTRICT,
  CONSTRAINT tipos_cita_nombre_check     CHECK (btrim(nombre) <> '' AND char_length(nombre) <= 60),
  CONSTRAINT tipos_cita_duracion_check   CHECK (duracion_min BETWEEN 5 AND 600 AND duracion_min % 5 = 0),
  CONSTRAINT tipos_cita_color_check      CHECK (color IS NULL OR color = ANY (ARRAY['indigo', 'magenta', 'carmin', 'oliva', 'bronce', 'grafito'])),
  -- Sólo un tipo de médico puede ser su duración; sólo un principal lleva consultorio.
  CONSTRAINT tipos_cita_principal_check   CHECK (NOT principal OR medico_id IS NOT NULL),
  CONSTRAINT tipos_cita_consultorio_check CHECK (consultorio_id IS NULL OR principal)
);

-- Nombre único por ámbito entre los ACTIVOS, DENTRO de la clínica (la llave
-- empieza por clinica_id: un conflicto nunca delata nombres de otra clínica).
-- No mira las filas por consultorio: repiten el nombre del principal general y
-- las cubre tipos_cita_principal_unico. Archivar libera el nombre.
CREATE UNIQUE INDEX tipos_cita_nombre_activo_unico ON public.tipos_cita
  (clinica_id, coalesce(medico_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nombre)))
  WHERE activo AND consultorio_id IS NULL;
-- Un principal activo por médico, y uno por médico y consultorio.
CREATE UNIQUE INDEX tipos_cita_principal_unico ON public.tipos_cita
  (clinica_id, medico_id, coalesce(consultorio_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE activo AND principal;
-- Los que usan las FK al comprobar RESTRICT desde profiles y consultorios.
CREATE INDEX tipos_cita_medico ON public.tipos_cita (medico_id) WHERE medico_id IS NOT NULL;
CREATE INDEX tipos_cita_consultorio ON public.tipos_cita (consultorio_id) WHERE consultorio_id IS NOT NULL;

ALTER TABLE public.tipos_cita ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tipos_cita FROM PUBLIC, anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tipos_cita FROM authenticated;
REVOKE TRUNCATE ON TABLE public.tipos_cita FROM service_role;

-- Sin recursión: ninguna policy lee tipos_cita, sólo helpers SECURITY DEFINER.
-- Sin policy de DELETE: archivar es UPDATE. Sin puerta de suscripción, a
-- propósito. El médico crea, cambia y archiva SUS tipos sin poder
-- reasignarlos (WITH CHECK = USING); el administrador, los de toda la clínica;
-- la secretaria sólo lee.
CREATE POLICY tipos_cita_select ON public.tipos_cita FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id IS NULL OR medico_id = auth.uid()
              OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
CREATE POLICY tipos_cita_insert ON public.tipos_cita FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (public.soy_admin_de_clinica()
                   OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')));
CREATE POLICY tipos_cita_update ON public.tipos_cita FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (public.soy_admin_de_clinica()
              OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (public.soy_admin_de_clinica()
                   OR (medico_id = auth.uid() AND public.get_my_role() = 'medico')));

-- Las tres funciones son INVOKER y no escriben otra tabla. Las dos de
-- validación leen con la RLS de quien escribe: si no ve la fila, rechazan
-- (falla cerrado). Por eso el administrador no puede ponerle a otro médico
-- una duración por consultorio (no ve sus consultorios).
CREATE FUNCTION public.validar_tipo_cita_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.medico_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.medico_id AND p.clinica_id = NEW.clinica_id AND p.role = 'medico') THEN
    RAISE EXCEPTION 'El médico del tipo de cita no pertenece a la clínica' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.validar_tipo_cita_medico() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_tipo_cita_medico() TO anon, authenticated, service_role;

-- src/lib/agenda/tiposCita.ts traduce el 23514 de esta función.
CREATE FUNCTION public.validar_tipo_cita_consultorio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.consultorio_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.consultorios c
        WHERE c.id = NEW.consultorio_id AND c.clinica_id = NEW.clinica_id AND c.medico_id = NEW.medico_id) THEN
    RAISE EXCEPTION 'El consultorio del tipo de cita no es de ese médico' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.validar_tipo_cita_consultorio() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_tipo_cita_consultorio() TO anon, authenticated, service_role;

CREATE FUNCTION public.update_tipos_cita_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.update_tipos_cita_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tipos_cita_updated_at() TO anon, authenticated, service_role;

CREATE TRIGGER trg_tipos_cita_medico
  BEFORE INSERT OR UPDATE OF medico_id, clinica_id ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_cita_medico();

CREATE TRIGGER trg_tipos_cita_consultorio
  BEFORE INSERT OR UPDATE OF consultorio_id, medico_id, clinica_id ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.validar_tipo_cita_consultorio();

CREATE TRIGGER trg_tipos_cita_updated_at
  BEFORE UPDATE ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.update_tipos_cita_updated_at();

CREATE TRIGGER audit_tipos_cita
  AFTER INSERT OR UPDATE OR DELETE ON public.tipos_cita
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 6 · Auditoría de citas, SIEMPRE encendida (no depende del interruptor).
--     Función propia y no log_tabla_change(): ésa escribe sólo TG_OP, y una
--     cancelación sería indistinguible de mover la hora.
--     ⚠️ NUNCA VALORES (ni título, ni notas, ni horas, ni paciente_id): sólo
--     NOMBRES de columna y el estado de→a. audit_log es inmutable y no admite
--     cancelación ARCO.
--     Las columnas técnicas (las que tocan la sincronización con Google y
--     desvincularCitas) no se auditan: las descarta el WHEN antes de llamar a
--     la función. Es lista de EXCLUSIÓN: una columna nueva queda auditada sola;
--     si es técnica, se añade en los DOS sitios.
--     AFTER y SECURITY DEFINER: DEFINER sólo para insertar en audit_log (no
--     tiene policy de INSERT); AFTER para que los BEFORE de protección aborten
--     antes sin dejar auditoría. Sus disparadores, en §10.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.log_cita_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- ⚠️ La misma lista que el WHEN de audit_appointments_update. Van juntas.
  c_tecnicas CONSTANT text[] := ARRAY['updated_at', 'client_id', 'gcal_sync_status',
                                      'gcal_etag', 'gcal_calendar_id', 'google_event_id'];
  -- 'google' y 'google_rsvp' los pone la sincronización con Google; 'enlace_paciente',
  -- la confirmación y el reagendo por enlace. Sólo éstos, sólo sin sesión. Un literal
  -- nuevo exige migración.
  c_vias     CONSTANT text[] := ARRAY['google', 'enlace_paciente', 'google_rsvp'];
  v_uid    uuid := auth.uid();
  v_via    text := current_setting('spinus.via', true);
  v_fila   record;
  v_campos text[];
  v_accion text;
  v_desc   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_fila := OLD; ELSE v_fila := NEW; END IF;
  v_desc := jsonb_build_object('clinica_id', v_fila.clinica_id,
                               'con_paciente', v_fila.paciente_id IS NOT NULL,
                               'origen', v_fila.origen);
  -- «Quién lo hizo sin sesión»: sólo sin auth.uid() y sólo un literal de la
  -- lista. Lo ponen las RPC de service_role con set_config(…, true).
  IF v_uid IS NULL AND v_via = ANY (c_vias) THEN
    v_desc := v_desc || jsonb_build_object('via', v_via);
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_accion := 'cita_alta';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'cita_eliminada';
  ELSE
    -- Sólo NOMBRES de columna: n.value se compara, nunca se escribe.
    SELECT coalesce(array_agg(n.key ORDER BY n.key), ARRAY[]::text[]) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n
     WHERE n.key <> ALL (c_tecnicas)
       AND (to_jsonb(OLD) -> n.key) IS DISTINCT FROM n.value;
    -- El WHEN ya lo garantiza; esto sólo evita una fila vacía si divergieran.
    IF cardinality(v_campos) = 0 THEN RETURN NULL; END IF;
    v_accion := CASE
      WHEN OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN 'cita_cancelada'
      WHEN OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN 'cita_reactivada'
      ELSE 'cita_editada'
    END;
    v_desc := v_desc || jsonb_build_object('campos', to_jsonb(v_campos));
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_desc := v_desc || jsonb_build_object('estado', jsonb_build_object('de', OLD.status, 'a', NEW.status));
    END IF;
  END IF;
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (coalesce(v_uid::text, 'system'), v_accion, 'appointments', v_fila.id, v_desc::text);
  RETURN NULL;  -- AFTER ... FOR EACH ROW: el valor de retorno se ignora.
END
$fn$;

-- Función de disparador: no se puede invocar por RPC («trigger functions can
-- only be called as triggers») y al dispararse no se comprueba EXECUTE.
REVOKE EXECUTE ON FUNCTION public.log_cita_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cita_change() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7 · El respaldo del backfill (la copia y el UPDATE, en §10). Tabla propia
--     del esquema respaldos: no toma candados sobre tablas de main.
-- ---------------------------------------------------------------------
-- horario / horario_propio / respaldado_en: la PRIMERA copia; no se pisan
-- nunca. horario_antes / horario_copiado / copiado_en: la ÚLTIMA pasada del
-- backfill (lo que había justo antes y lo que escribió); con ellas la reversa
-- reconoce un horario que nadie tocó, aunque se haya editado otro campo, y el
-- ciclo aplicar → revertir → reaplicar → revertir funciona cada vez (A4).
CREATE TABLE IF NOT EXISTS respaldos.consultorios_horario_20261119 (
  id              uuid PRIMARY KEY,
  clinica_id      uuid NOT NULL,
  horario         jsonb NOT NULL,
  horario_propio  boolean NOT NULL,
  respaldado_en   timestamptz NOT NULL DEFAULT now(),
  horario_antes   jsonb NOT NULL,
  horario_copiado jsonb NOT NULL,
  copiado_en      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE respaldos.consultorios_horario_20261119 ENABLE ROW LEVEL SECURITY;
-- Sin privilegios para nadie más que su dueño; el esquema no se expone a PostgREST.
REVOKE ALL ON TABLE respaldos.consultorios_horario_20261119 FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8 · «Restablecer configuración de la agenda» de UNA clínica. La llama sólo
--     POST /api/agenda/restablecer con service_role, tras comprobar que el
--     actor administra la clínica; la función lo vuelve a comprobar, PRIMERO
--     (antes de mirar el interruptor: nadie sondea otra clínica por aquí).
--     ⚠️ INVOKER: no la hagas SECURITY DEFINER, se saltaría los disparadores
--     de ajustes (proteger_agenda_ajustes) y de enlaces (proteger_reserva_
--     enlaces, que deja revocar a service_role y no reactivar).
--     La lectura del interruptor se queda en línea: lleva FOR UPDATE (dos
--     restablecimientos o un guardado de plazos a la vez van en fila) y
--     devuelve el id de la fila; agenda_v2_encendida() no es equivalente.
--     No toca citas, pacientes, auditoría (salvo añadir), contactos ni
--     bloqueos; el interruptor y el candado tampoco.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.agenda_restablecer_configuracion(p_clinica_id uuid, p_actor uuid)
RETURNS TABLE (r_resultado text, r_consultorios integer, r_tipos integer, r_enlaces integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_ajustes uuid;
  v_cons    integer;
  v_tipos   integer;
  v_enlaces integer;
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'agenda_restablecer_configuracion: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- Primero QUIÉN (aunque la clínica esté apagada): nadie que no la administre
  -- aprende nada de ella por esta función.
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr
                  WHERE pr.id = p_actor AND pr.clinica_id = p_clinica_id
                    AND pr.role = 'medico' AND pr.es_admin_de_clinica IS TRUE) THEN
    RETURN QUERY SELECT 'sin_permiso'::text, 0, 0, 0;
    RETURN;
  END IF;
  SELECT j.id INTO v_ajustes FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'apagado'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Respaldo del horario que se va a pisar: UNA fila de audit_log por
  -- consultorio con su horario y horario_propio de antes (no son datos de
  -- pacientes). Es lo único del reinicio que no se recupera desde la pantalla.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  SELECT p_actor::text, 'agenda_horario_restablecido', 'consultorios', c.id,
         jsonb_build_object('horario_propio', c.horario_propio, 'horario', c.horario)::text
    FROM public.consultorios c
   WHERE c.clinica_id = p_clinica_id;

  -- El horario de partida de la v2: el de la clínica COPIADO y propio, la misma
  -- herencia del backfill de los consultorios. La única fuente sigue siendo el
  -- consultorio, y queda POR REVISAR hasta que su médico lo confirme.
  UPDATE public.consultorios c SET horario = cl.horario_consulta, horario_propio = true, horario_revisado_en = NULL
    FROM public.clinicas cl
   WHERE cl.id = c.clinica_id AND c.clinica_id = p_clinica_id;
  GET DIAGNOSTICS v_cons = ROW_COUNT;

  UPDATE public.tipos_cita t SET activo = false
   WHERE t.clinica_id = p_clinica_id AND t.activo;
  GET DIAGNOSTICS v_tipos = ROW_COUNT;

  UPDATE public.reserva_enlaces e SET revocado_en = now(), revocado_por = p_actor
   WHERE e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.usado_en IS NULL
     AND (e.caduca_en IS NULL OR e.caduca_en > now());
  GET DIAGNOSTICS v_enlaces = ROW_COUNT;

  UPDATE public.agenda_ajustes j
     SET recordatorio_horas = DEFAULT, anticipacion_min_horas = DEFAULT, horizonte_dias = DEFAULT,
         vigencia_enlace_unico_dias = DEFAULT, recordatorio_encendido = DEFAULT
   WHERE j.id = v_ajustes;

  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (p_actor::text, 'agenda_configuracion_restablecida', 'agenda_ajustes', v_ajustes,
          format('consultorios: %s; tipos archivados: %s; enlaces revocados: %s', v_cons, v_tipos, v_enlaces));

  RETURN QUERY SELECT 'ok'::text, v_cons, v_tipos, v_enlaces;
END
$fn$;

-- Más cerrada que la regla general: sólo service_role. Reescribe la
-- configuración de una clínica entera con los parámetros que le pasen; la
-- puerta es la ruta del servidor.
REVOKE EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 9 · Los convenios, donde viajan con la base (los de las columnas nuevas
--     de appointments, consultorios y clinicas, en §10).
-- ---------------------------------------------------------------------
COMMENT ON TABLE public.agenda_ajustes IS
  'Ajustes de agenda por clínica (mejora_agendaV2 §2). Sin fila = valores de fábrica (24 h, 2 h, 60 d, 7 d) e interruptor apagado. Los límites viven aquí en CHECK y en LIMITES_AJUSTES_AGENDA (src/lib/agenda/ajustesAgenda.ts): cambiar los dos.';
COMMENT ON COLUMN public.agenda_ajustes.agenda_v2_encendida IS
  'Interruptor de las funciones nuevas de la agenda para ESTA clínica. Sólo lo cambia postgres (trg_agenda_ajustes_proteger). Cualquier error al leerlo se trata como false.';
COMMENT ON COLUMN public.agenda_ajustes.candado_citas_activas IS
  'Candado de la reserva por enlace (§2), fijo por ahora; no se expone en pantalla. Los cuatro candado_* sólo los cambia postgres, y sus DEFAULT están repetidos en proteger_agenda_ajustes().';
COMMENT ON COLUMN public.agenda_ajustes.recordatorio_encendido IS
  'Recordatorio automático por correo. APAGADO de fábrica: sólo con true la tarea /api/cron/recordatorios lista las citas de esta clínica (cita_recordatorios_pendientes). No afecta al código ni al comprobante de la reserva por enlace ni a la confirmación que manda el personal. Lo cambia el administrador de la clínica desde la configuración (policy agenda_ajustes_update).';
COMMENT ON COLUMN public.agenda_ajustes.correo_reserva_clinica IS
  'Correo a los administradores de la clínica por cada reserva nueva por enlace (nombre, fecha, hora, médico y consultorio; nada clínico). APAGADO de fábrica. Lo cambia el administrador desde la configuración (policy agenda_ajustes_update).';
COMMENT ON FUNCTION public.agenda_v2_encendida(uuid) IS
  'La única lectura común del interruptor de la agenda v2 de una clínica. Sin fila = false (falla cerrado). INVOKER a propósito: con la sesión lee con la RLS de agenda_ajustes (sólo la clínica propia); dentro de una SECURITY DEFINER, como su dueño. No la hagas DEFINER. Sin EXECUTE para anon.';
COMMENT ON TABLE public.tipos_cita IS
  'Tipos de cita de la clínica. medico_id NULL = de toda la clínica; con valor = sólo de ese médico. Se archivan (activo=false), nunca se borran. Los límites (nombre 1-60, duración 5-600 en múltiplos de 5, los seis colores) están aquí en CHECK y en src/lib/agenda/tiposCita.ts: cambiar los dos.';
COMMENT ON COLUMN public.tipos_cita.principal IS
  'La duración de la consulta del médico: su tipo principal, creado al contestar «¿cuánto dura tu consulta?». Sólo con medico_id (tipos_cita_principal_check); uno activo por médico y, aparte, uno por médico y consultorio (tipos_cita_principal_unico).';
COMMENT ON COLUMN public.tipos_cita.consultorio_id IS
  'Sólo en un tipo principal (tipos_cita_consultorio_check): la duración distinta del médico en ESE consultorio, que allí sustituye a su principal general. El consultorio es del mismo médico y clínica (validar_tipo_cita_consultorio). CONVENIO QUE LA BASE NO IMPONE: reservar_por_enlace acepta el tipo en cualquier consultorio del médico; la ruta pública lo filtra antes (tiposDelConsultorio en src/lib/agenda/tiposCita.ts). En la agenda interna es sólo la lista del selector.';
COMMENT ON FUNCTION public.log_cita_change() IS
  'Auditoría de public.appointments (AG-DT-10). Escribe NOMBRES de columnas y estado de→a, nunca valores: audit_log es inmutable y no admite ARCO. "via" sólo sin auth.uid() y con el GUC spinus.via en la lista blanca c_vias: google y google_rsvp (sincronización con Google), enlace_paciente (confirmación y reagendo por enlace); otro literal no se escribe. La lista c_tecnicas está también en el WHEN de audit_appointments_update: cambiar las dos.';
COMMENT ON TABLE respaldos.consultorios_horario_20261119 IS
  'consultorios.horario y horario_propio de cada consultorio sin horario propio, ANTES de heredar el de su clínica (backfill de 20261201120000_agenda_f1). horario, horario_propio y respaldado_en son la PRIMERA copia y no se pisan nunca. horario_antes, horario_copiado y copiado_en son de la ÚLTIMA pasada del backfill: lo que había justo antes, lo que escribió (el de la clínica) y cuándo. La reversa de F1 devuelve horario_antes sólo donde consultorios.horario sigue siendo horario_copiado.';
COMMENT ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) IS
  'Restablece la configuración de la agenda v2 de UNA clínica: consultorios al horario de partida de la v2 (el de la clínica copiado como horario propio) y POR REVISAR (horario_revisado_en NULL), tipos de cita archivados, enlaces de reserva vigentes revocados, plazos de fábrica y recordatorio apagado; una fila en audit_log. No toca citas, pacientes, auditoría ni contactos bloqueados. Sólo service_role; la llama POST /api/agenda/restablecer tras comprobar que p_actor es el administrador de p_clinica_id (y la función lo vuelve a comprobar).';

-- ---------------------------------------------------------------------
-- 10 · Candados, segundo tiempo, y TODO lo que exige ACCESS EXCLUSIVE sobre
--      tablas de main, en UN solo bloque: un viaje al servidor desde que se
--      toman hasta que acaba. ACCESS EXCLUSIVE sobre appointments,
--      consultorios y clinicas a la vez, NOWAIT, 50 intentos cada 0,1 s.
-- ---------------------------------------------------------------------
DO $tablas_main$
DECLARE
  v_intento integer := 0;
BEGIN
  LOOP
    v_intento := v_intento + 1;
    BEGIN
      LOCK TABLE public.appointments, public.consultorios, public.clinicas IN ACCESS EXCLUSIVE MODE NOWAIT;
      EXIT;
    EXCEPTION WHEN lock_not_available THEN
      IF v_intento >= 50 THEN
        RAISE EXCEPTION 'CANDADOS: appointments, consultorios o clinicas siguieron ocupadas 5 s (una transacción larga las lee o escribe). No se cambió nada: reintenta en unos minutos.'
          USING ERRCODE = '55P03';
      END IF;
      PERFORM pg_sleep(0.1);
    END;
  END LOOP;

  -- appointments: el tipo de la cita y la instantánea de su nombre.
  -- FK COMPUESTA (tipo_cita_id, clinica_id): la base impide que una cita
  -- use un tipo de OTRA clínica, y el error es el mismo exista o no el tipo
  -- ajeno (no delata ids). Que el tipo sea de toda la clínica o del médico
  -- de la cita es un CONVENIO que comprueba la API (va en el COMMENT).
  ALTER TABLE public.appointments
    ADD COLUMN tipo_cita_id uuid,
    ADD COLUMN tipo_cita_nombre text,
    ADD CONSTRAINT appointments_tipo_cita_fkey
      FOREIGN KEY (tipo_cita_id, clinica_id) REFERENCES public.tipos_cita (id, clinica_id) ON DELETE RESTRICT,
    ADD CONSTRAINT appointments_tipo_cita_snapshot_check
      CHECK ((tipo_cita_id IS NULL) = (tipo_cita_nombre IS NULL));

  -- El que usa la FK al comprobar RESTRICT desde tipos_cita.
  CREATE INDEX idx_appointments_tipo_cita ON public.appointments (tipo_cita_id)
    WHERE tipo_cita_id IS NOT NULL;

  -- Los dos disparadores de la auditoría de citas (log_cita_change, §6).
  CREATE TRIGGER audit_appointments
    AFTER INSERT OR DELETE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.log_cita_change();

  -- Partido en dos a propósito: un WHEN que lee OLD no se admite en INSERT.
  -- ⚠️ La misma lista que c_tecnicas de log_cita_change(). Van juntas.
  CREATE TRIGGER audit_appointments_update
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    WHEN ((to_jsonb(OLD) - ARRAY['updated_at','client_id','gcal_sync_status','gcal_etag','gcal_calendar_id','google_event_id']::text[])
          IS DISTINCT FROM
          (to_jsonb(NEW) - ARRAY['updated_at','client_id','gcal_sync_status','gcal_etag','gcal_calendar_id','google_event_id']::text[]))
    EXECUTE FUNCTION public.log_cita_change();

  -- Horarios de consultorio y huso de la clínica (columnas en tablas de
  -- main; contrato con spinus-consola: sólo se añaden, nunca se renombran
  -- ni cambian de tipo o significado).
  -- clinicas.timezone: text NULL sin DEFAULT ni CHECK (NULL = sin elegir).
  -- clinicas.horario_consulta NO se escribe nunca: sólo se lee.
  ALTER TABLE public.consultorios
    ADD COLUMN horario_propio boolean NOT NULL DEFAULT false,
    ADD COLUMN horario_revisado_en timestamptz;

  ALTER TABLE public.clinicas ADD COLUMN timezone text;

  -- Backfill (el ÚNICO del conjunto): cada consultorio hereda UNA vez el
  -- horario de su clínica como punto de partida. La única fuente de la
  -- disponibilidad pasa a ser el consultorio; editar el de la clínica ya no
  -- mueve el de ningún consultorio. El horario EFECTIVO no cambia: con
  -- horario_propio = false, horarioEfectivo() daba el de la clínica.
  -- Para TODAS las clínicas, también las de la v2 apagada: con ella apagada
  -- ningún código lee horario_propio ni consultorios.horario.
  -- El valor previo de consultorios.horario era INERTE (nadie lo leía) y
  -- queda en el respaldo, escrito ANTES del UPDATE: horario_antes (lo que
  -- había justo antes de ESTA pasada) y horario_copiado (lo que el UPDATE
  -- escribe, el de su clínica). La reversa devuelve horario_antes sólo donde
  -- consultorios.horario sigue siendo horario_copiado: una edición de otro
  -- campo no cuenta como edición del horario. copiado_en y el updated_at que
  -- pone trg_consultorios_updated_at son el mismo now() de esta transacción.
  -- Si el respaldo ya existía (un reintento tras la reversa), la PRIMERA
  -- copia (horario, horario_propio, respaldado_en) se conserva y sólo se
  -- renuevan las columnas de la última pasada.
  INSERT INTO respaldos.consultorios_horario_20261119 AS r
         (id, clinica_id, horario, horario_propio, horario_antes, horario_copiado, copiado_en)
  SELECT k.id, k.clinica_id, k.horario, k.horario_propio, k.horario, c.horario_consulta, now()
    FROM public.consultorios k
    JOIN public.clinicas c ON c.id = k.clinica_id
   WHERE NOT k.horario_propio
  ON CONFLICT (id) DO UPDATE
     SET horario_antes = EXCLUDED.horario_antes, horario_copiado = EXCLUDED.horario_copiado,
         copiado_en = EXCLUDED.copiado_en;

  -- También los archivados: si se reactivan, conservan el punto de partida.
  UPDATE public.consultorios k
     SET horario = c.horario_consulta,
         horario_propio = true
    FROM public.clinicas c
   WHERE c.id = k.clinica_id
     AND NOT k.horario_propio;

  COMMENT ON COLUMN public.appointments.tipo_cita_id IS
    'Tipo de la cita. La FK compuesta garantiza la misma clínica. CONVENIO QUE LA BASE NO IMPONE: el tipo es de toda la clínica (medico_id NULL) o del medico_id de la cita, y la cita tiene paciente O está por ligar (reserva_canal no nulo). Lo comprueban reservar_por_enlace y POST/PUT /api/appointments (validarTipoParaCita en src/lib/agenda/tiposCita.ts, que mientras no se amplíe sólo admite tipo con paciente). Un camino que escriba la columna sin pasar por ahí puede dejar un tipo de otro médico sin que nada lo note.';
  COMMENT ON COLUMN public.appointments.tipo_cita_nombre IS
    'Instantánea del nombre del tipo al asignarlo (como consultorio_nombre). Renombrar el tipo no la cambia. Va junto con tipo_cita_id: las dos nulas o las dos con valor (appointments_tipo_cita_snapshot_check); quitar el tipo es poner las dos a NULL.';
  COMMENT ON COLUMN public.consultorios.horario_propio IS
    'false = la disponibilidad de este consultorio es clinicas.horario_consulta; true = manda consultorios.horario (un tramo por día, sin pausa; con true y todos los días inactivos el consultorio está CERRADO, no hereda). Lo resuelve horarioEfectivo() en src/lib/agenda/disponibilidad.ts. Al crearse esta columna, todos los consultorios existentes heredaron una vez el horario de su clínica (true; respaldo en respaldos.consultorios_horario_20261119) y, con la agenda v2, la rejilla, los avisos y la reserva usan el de cada consultorio; clinicas.horario_consulta sólo queda como respaldo de los consultorios nuevos que sigan en false.';
  COMMENT ON COLUMN public.consultorios.horario_revisado_en IS
    'Agenda v2: cuándo una persona confirmó o guardó el horario de este consultorio desde la configuración de la agenda. NULL = por revisar (lo heredó de la clínica al crearse la columna, lo dejó «Restablecer» o nadie lo ha confirmado). La escribe PATCH /api/consultorios/[id] con la v2; agenda_restablecer_configuracion la vuelve a NULL.';
  COMMENT ON COLUMN public.clinicas.timezone IS
    'Huso horario IANA «de fábrica» de la clínica; NULL = aún sin elegir. Lo escribe sólo PUT /api/me/horario (administrador, validado contra Intl.supportedValuesOf). CONVENIO: NO lo lee la rejilla, ni la reserva, ni los correos: cada consultorio tiene su propio consultorios.timezone, que cambiar éste NO toca. Sólo propone el huso de los consultorios que se creen.';
END $tablas_main$;

-- ---------------------------------------------------------------------
-- 11 · Post-vuelo. Si algo no quedó como debe, aborta y se deshace TODO.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_f      oid;
  v_rol    text;
  v_tabla  text;
  v_fn_tec text[];
  v_old    text[];
  v_new    text[];
  v_def    text;
BEGIN
  -- RLS activada en las tres tablas.
  IF (SELECT count(*) FROM pg_class WHERE relrowsecurity
       AND oid IN ('public.agenda_ajustes'::regclass, 'public.tipos_cita'::regclass,
                   'respaldos.consultorios_horario_20261119'::regclass)) <> 3 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: falta RLS en agenda_ajustes, tipos_cita o el respaldo.';
  END IF;
  -- Privilegios de tabla exactos.
  FOREACH v_tabla IN ARRAY ARRAY['public.agenda_ajustes', 'public.tipos_cita'] LOOP
    IF has_table_privilege('anon', v_tabla, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated', v_tabla, 'DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR NOT has_table_privilege('authenticated', v_tabla, 'SELECT') OR NOT has_table_privilege('authenticated', v_tabla, 'INSERT')
       OR NOT has_table_privilege('authenticated', v_tabla, 'UPDATE')
       OR has_table_privilege('service_role', v_tabla, 'TRUNCATE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: privilegios de % distintos de los esperados.', v_tabla;
    END IF;
  END LOOP;
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_table_privilege(v_rol, 'respaldos.consultorios_horario_20261119', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % tiene privilegios sobre el respaldo.', v_rol;
    END IF;
  END LOOP;
  -- Ninguna función de este bloque ejecutable por PUBLIC; DEFINER sólo
  -- log_cita_change; todas con search_path vacío.
  IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE p.oid IN ('public.agenda_v2_encendida(uuid)'::regprocedure, 'public.proteger_agenda_ajustes()'::regprocedure,
                              'public.validar_tipo_cita_medico()'::regprocedure, 'public.validar_tipo_cita_consultorio()'::regprocedure,
                              'public.update_tipos_cita_updated_at()'::regprocedure, 'public.log_cita_change()'::regprocedure,
                              'public.agenda_restablecer_configuracion(uuid,uuid)'::regprocedure)
                AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: alguna función de F1 es ejecutable por PUBLIC.';
  END IF;
  IF (SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || coalesce(array_to_string(p.proconfig, ','), '-'), ' ' ORDER BY p.proname)
        FROM pg_proc p
       WHERE p.oid IN ('public.agenda_v2_encendida(uuid)'::regprocedure, 'public.proteger_agenda_ajustes()'::regprocedure,
                       'public.validar_tipo_cita_medico()'::regprocedure, 'public.validar_tipo_cita_consultorio()'::regprocedure,
                       'public.update_tipos_cita_updated_at()'::regprocedure, 'public.log_cita_change()'::regprocedure,
                       'public.agenda_restablecer_configuracion(uuid,uuid)'::regprocedure))
     <> 'agenda_restablecer_configuracion=false/search_path="" agenda_v2_encendida=false/search_path="" log_cita_change=true/search_path="" proteger_agenda_ajustes=false/search_path="" update_tipos_cita_updated_at=false/search_path="" validar_tipo_cita_consultorio=false/search_path="" validar_tipo_cita_medico=false/search_path=""' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: SECURITY DEFINER o search_path de las funciones de F1 distintos de los esperados.';
  END IF;
  v_f := 'public.agenda_v2_encendida(uuid)'::regprocedure;
  IF has_function_privilege('anon', v_f, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_f, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_f, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: EXECUTE de agenda_v2_encendida distinto de authenticated + service_role.';
  END IF;
  v_f := 'public.agenda_restablecer_configuracion(uuid,uuid)'::regprocedure;
  IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_f, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: EXECUTE de agenda_restablecer_configuracion distinto de sólo service_role.';
  END IF;
  -- c_tecnicas: la misma lista, en el mismo orden, en la función y en los dos
  -- lados del WHEN. c_vias: los tres literales que ponen F2 y F4.
  SELECT array_agg(m[1] ORDER BY o) INTO v_fn_tec
    FROM regexp_matches((regexp_match((SELECT prosrc FROM pg_proc WHERE oid = 'public.log_cita_change()'::regprocedure),
                                      'c_tecnicas\s+CONSTANT\s+text\[\]\s*:=\s*ARRAY\[([^]]*)\]'))[1],
                        '''([a-z_]+)''', 'g') WITH ORDINALITY AS r(m, o);
  SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
   WHERE t.tgrelid = 'public.appointments'::regclass AND t.tgname = 'audit_appointments_update';
  SELECT array_agg(m[1] ORDER BY o) INTO v_old
    FROM regexp_matches((regexp_match(v_def, 'to_jsonb\(old\.\*\) - ARRAY\[([^]]*)\]'))[1], '''([a-z_]+)''', 'g') WITH ORDINALITY AS r(m, o);
  SELECT array_agg(m[1] ORDER BY o) INTO v_new
    FROM regexp_matches((regexp_match(v_def, 'to_jsonb\(new\.\*\) - ARRAY\[([^]]*)\]'))[1], '''([a-z_]+)''', 'g') WITH ORDINALITY AS r(m, o);
  IF v_fn_tec IS NULL OR v_fn_tec IS DISTINCT FROM v_old OR v_fn_tec IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: c_tecnicas de log_cita_change (%) y el WHEN de audit_appointments_update (% / %) no coinciden.',
      v_fn_tec, v_old, v_new;
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.log_cita_change()'::regprocedure)
     !~ 'c_vias\s+CONSTANT\s+text\[\]\s*:=\s*ARRAY\[''google'', ''enlace_paciente'', ''google_rsvp''\]' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: la lista blanca c_vias de log_cita_change no es {google, enlace_paciente, google_rsvp}.';
  END IF;
  -- Los dos disparadores de auditoría, AFTER, de fila, activos y con la función.
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.appointments'::regclass AND t.tgenabled = 'O'
         AND t.tgfoid = 'public.log_cita_change()'::regprocedure
         AND (t.tgtype & 1) = 1 AND (t.tgtype & 2) = 0
         AND t.tgname IN ('audit_appointments', 'audit_appointments_update')) <> 2 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: audit_appointments / audit_appointments_update no quedaron AFTER ROW con log_cita_change.';
  END IF;
  -- El backfill: ningún consultorio de una clínica existente sigue sin horario propio.
  IF EXISTS (SELECT 1 FROM public.consultorios k JOIN public.clinicas c ON c.id = k.clinica_id WHERE NOT k.horario_propio) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: quedan consultorios con horario_propio = false tras el backfill.';
  END IF;
  -- El interruptor apagado sin fila.
  IF public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_v2_encendida no devuelve false sin fila.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 12 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO'
            WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'RLS de agenda_ajustes / tipos_cita / respaldo' AS comprobacion,
         coalesce((SELECT string_agg(relrowsecurity::text, ' / ' ORDER BY x.o)
                     FROM unnest(ARRAY['public.agenda_ajustes', 'public.tipos_cita', 'respaldos.consultorios_horario_20261119'])
                          WITH ORDINALITY AS x(t, o)
                     JOIN pg_class c ON c.oid = to_regclass(x.t)), 'AUSENTE') AS valor,
         'true / true / true' AS esperado
  UNION ALL
  SELECT 2, 'policies (ninguna de DELETE)',
         (SELECT string_agg(tablename || ':' || cmd, ',' ORDER BY tablename, cmd) FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('agenda_ajustes', 'tipos_cita')),
         'agenda_ajustes:INSERT,agenda_ajustes:SELECT,agenda_ajustes:UPDATE,tipos_cita:INSERT,tipos_cita:SELECT,tipos_cita:UPDATE'
  UNION ALL
  SELECT 3, 'privilegios de tabla de authenticated (anon: ninguno; service_role sin TRUNCATE)',
         (SELECT string_agg(table_name || ':' || privilege_type, ',' ORDER BY table_name, privilege_type)
            FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name IN ('agenda_ajustes', 'tipos_cita')
             AND (grantee IN ('anon', 'authenticated') OR (grantee = 'service_role' AND privilege_type = 'TRUNCATE'))),
         'agenda_ajustes:INSERT,agenda_ajustes:SELECT,agenda_ajustes:UPDATE,tipos_cita:INSERT,tipos_cita:SELECT,tipos_cita:UPDATE'
  UNION ALL
  SELECT 4, 'agenda_v2_encendida: INVOKER / STABLE / EXECUTE anon,authenticated,service_role / sin fila',
         coalesce((SELECT (NOT p.prosecdef)::text || ' / ' || p.provolatile::text || ' / '
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                          || public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid)::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')), 'AUSENTE'),
         'true / s / false,true,true / false'
  UNION ALL
  SELECT 5, 'agenda_restablecer_configuracion: INVOKER / EXECUTE anon,authenticated,service_role',
         coalesce((SELECT (NOT p.prosecdef)::text || ' / '
                          || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         'true / false,false,true'
  UNION ALL
  SELECT 6, 'log_cita_change: DEFINER / search_path / sin PUBLIC',
         coalesce((SELECT p.prosecdef::text || ' / ' || coalesce(array_to_string(p.proconfig, ','), '') || ' / '
                          || (NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                           WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE'),
         'true / search_path="" / true'
  UNION ALL
  SELECT 7, 'disparadores de appointments de F1',
         (SELECT string_agg(t.tgname || '→' || p.proname, ',' ORDER BY t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE t.tgrelid = 'public.appointments'::regclass AND t.tgname LIKE 'audit_appointments%' AND t.tgenabled = 'O'),
         'audit_appointments→log_cita_change,audit_appointments_update→log_cita_change'
  UNION ALL
  SELECT 8, 'disparadores de agenda_ajustes y tipos_cita',
         (SELECT string_agg(c.relname || '.' || t.tgname, ',' ORDER BY c.relname, t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE t.tgrelid IN (to_regclass('public.agenda_ajustes'), to_regclass('public.tipos_cita'))
             AND NOT t.tgisinternal AND t.tgenabled = 'O'),
         'agenda_ajustes.audit_agenda_ajustes,agenda_ajustes.trg_agenda_ajustes_proteger,tipos_cita.audit_tipos_cita,tipos_cita.trg_tipos_cita_consultorio,tipos_cita.trg_tipos_cita_medico,tipos_cita.trg_tipos_cita_updated_at'
  UNION ALL
  SELECT 9, 'FK RESTRICT (agenda_ajustes, tipos_cita ×3, appointments_tipo_cita_fkey)',
         (SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
           WHERE contype = 'f' AND conrelid IN (to_regclass('public.agenda_ajustes'), to_regclass('public.tipos_cita'), 'public.appointments'::regclass)
             AND conname IN ('agenda_ajustes_clinica_id_fkey', 'tipos_cita_clinica_id_fkey', 'tipos_cita_medico_id_fkey',
                             'tipos_cita_consultorio_id_fkey', 'appointments_tipo_cita_fkey')),
         'agenda_ajustes_clinica_id_fkey=r,appointments_tipo_cita_fkey=r,tipos_cita_clinica_id_fkey=r,tipos_cita_consultorio_id_fkey=r,tipos_cita_medico_id_fkey=r'
  UNION ALL
  SELECT 10, 'columnas en tablas de main (tipo / NOT NULL / default)',
         (SELECT string_agg(c.relname || '.' || a.attname || '=' || format_type(a.atttypid, a.atttypmod)
                            || '/' || a.attnotnull::text || '/' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-'), ','
                            ORDER BY c.relname, a.attname)
            FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE NOT a.attisdropped
             AND (a.attrelid, a.attname) IN (('public.appointments'::regclass, 'tipo_cita_id'), ('public.appointments'::regclass, 'tipo_cita_nombre'),
                                             ('public.consultorios'::regclass, 'horario_propio'), ('public.consultorios'::regclass, 'horario_revisado_en'),
                                             ('public.clinicas'::regclass, 'timezone'))),
         'appointments.tipo_cita_id=uuid/false/-,appointments.tipo_cita_nombre=text/false/-,clinicas.timezone=text/false/-,consultorios.horario_propio=boolean/true/false,consultorios.horario_revisado_en=timestamp with time zone/false/-'
  UNION ALL
  SELECT 11, 'consultorios con horario_propio = false (deben quedar 0)',
         (SELECT count(*)::text FROM public.consultorios WHERE NOT horario_propio), '0'
  UNION ALL
  SELECT 12, 'consultorios respaldados (los que heredaron)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119), NULL
  UNION ALL
  SELECT 13, 'heredados sin editar cuyo horario NO es el de su clínica (deben ser 0)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119 r
            JOIN public.consultorios k ON k.id = r.id
            JOIN public.clinicas c ON c.id = k.clinica_id
           WHERE k.updated_at = r.copiado_en
             AND (k.horario IS DISTINCT FROM c.horario_consulta OR k.horario IS DISTINCT FROM r.horario_copiado
                  OR NOT k.horario_propio)),
         '0'
  UNION ALL
  SELECT 14, 'heredados sin fila UPDATE de la copia en audit_log (deben ser 0)',
         (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119 r
            JOIN public.consultorios k ON k.id = r.id
           WHERE k.updated_at = r.copiado_en
             AND NOT EXISTS (SELECT 1 FROM public.audit_log a
                              WHERE a.tabla = 'consultorios' AND a.accion = 'UPDATE'
                                AND a.registro_id = r.id AND a.created_at = r.copiado_en)),
         '0'
  UNION ALL
  SELECT 15, 'policies de appointments y consultorios, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('appointments', 'consultorios')),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update,consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update'
) t
ORDER BY t.n;
