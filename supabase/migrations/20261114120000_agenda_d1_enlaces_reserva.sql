-- ═══════════════════════════════════════════════════════════════════════
-- Agenda D1 — enlaces de reserva, versiones aprobadas del aviso y columnas de
-- la reserva en appointments
-- Rama: feature/agenda-v2 (worktree feature/agenda-v2-d) · Escrita: 2026-11-11
-- Riesgo estimado: MEDIO (11 columnas, 2 FK, 2 CHECK y 3 índices parciales
-- sobre appointments; dos tablas nuevas vacías).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 11 × OK + 1 INFO,
--   0 / 0 / 0). Antes, ensayos en una transacción con ROLLBACK (la rejilla
--   igual, y el pre-vuelo probado: con un appointments_reserva_check de otra
--   fórmula aborta con «existe con OTRA fórmula»). Pasadas siguientes: misma
--   rejilla, sólo NOTICE «already exists, skipping» (2 tablas, 11 columnas, 5
--   índices), y no-op comprobado comparando antes y después una huella de
--   catálogo de 132 renglones (columnas con tipo, NOT NULL, DEFAULT y COMMENT;
--   relacl, RLS y COMMENT de las tablas; constraints; índices; policies;
--   disparadores; md5, proacl, prosecdef y COMMENT de las funciones) y
--   count(*) de audit_log de las dos tablas: sin diferencias. Anotada a mano
--   en supabase_migrations.schema_migrations (versión 20261114120000, 62
--   sentencias partidas como las parte la CLI), por la misma razón que B0.
--   Pruebas: supabase/pruebas-sql/d1_enlaces_reserva.sql (bash
--   scripts/pruebas-sql.sh) y src/lib/tests/secretosReserva.test.ts.
--   Comprobación:
--     select relrowsecurity, (select count(*) from pg_policies
--              where schemaname = 'public' and tablename = 'reserva_enlaces')
--       from pg_class where oid = 'public.reserva_enlaces'::regclass;
--   → t, 3.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, B6 y C1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes de aplicar en local:
--   · usado_cita_id podía apuntar a una cita de OTRA clínica (su FK es de una
--     columna). El auditor propuso FK compuesta + UNIQUE(id, clinica_id) en
--     appointments; se eligió en su lugar que proteger_reserva_enlaces exija
--     que la cita que gasta el enlace sea de ESE enlace y de ESA clínica
--     (23514), sin índice nuevo sobre la tabla más grande. Prueba: caso 8.
--   · COMMENT ON COLUMN en las 8 columnas reserva_* que no lo tenían (dim. 16).
--   Corregido por el autor antes de la auditoría: el CHECK de coherencia de la
--   cita y el de vigencia del enlace PASABAN con columnas NULL (un CHECK que
--   evalúa a NULL no falla: `NULL ~ '…'`); ahora cada columna lleva su IS NOT
--   NULL explícito. Y el pre-vuelo compara la fórmula de las constraints que
--   se crean «si no existe el nombre» (lección de B6).
--   Dimensión propuesta por el auditor (no se tocó AUDITORIA-MIGRACIONES.md):
--   cuando dos tablas con clinica_id se referencian mutuamente, las DOS
--   direcciones deben atar la clínica, no sólo una.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §2 («Tipo de enlace», «Paciente de esa reserva») y §5 D.
-- reserva_enlaces — uno FIJO vigente por médico (índice único parcial) y los
--   de UN SOLO USO con vigencia. EL CÓDIGO NO SE GUARDA: el servidor lo deriva
--   como HMAC(RESERVA_SECRETO, 'enlace:' || id) y aquí sólo vive sha256(código)
--   en hex, que es por donde se busca. Se puede volver a enseñar sin que la
--   base tenga nada que filtrar. Regenerar = revocar y emitir otro id.
--   UNIQUE(codigo_hash) es global a propósito: la búsqueda no conoce la
--   clínica; un choque exige adivinar un código de 128 bits (dimensión 10).
--   La vigencia del único se congela al emitir (vigencia_dias, caduca_en) con
--   el ajuste de ESE momento (§2); la pone el disparador e ignora lo que mande
--   quien escribe. Sólo se revocan; sin DELETE.
-- reserva_avisos — versión y sha256 del texto del aviso de la reserva. Sólo el
--   editor SQL aprueba. Sin versión aprobada con el mismo hash que el texto del
--   código, no hay reserva (segundo interruptor de §5 D, atado al texto).
-- appointments.reserva_* — la cita guarda nombre, teléfono y correo SIN
--   paciente (§2). «Por ligar» = reserva_canal no nulo y paciente_id nulo.
--   *_hmac = llave del candado (D2). Nada de esto viaja a Google (S1).
-- CONVENIO QUE LA BASE NO IMPONE (dimensión 16): una cita por ligar puede
--   llevar tipo de cita; va en el COMMENT de tipo_cita_id.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 y B6. PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TABLE con FK → SHARE ROW EXCLUSIVE un
--   instante sobre clinicas y profiles. ADD COLUMN ×11 → ACCESS EXCLUSIVE
--   sobre appointments hasta el COMMIT (sólo catálogo: un único DEFAULT
--   constante). ADD CONSTRAINT FK/CHECK recorren appointments (todo NULL).
--   CREATE INDEX parciales sobre filas inexistentes. Instantáneo hoy.
-- Orden respecto al código: PRIMERO esta migración. El código sólo nombra
--   reserva_* con el interruptor encendido (convenio de B6c).
-- Alcance de los roles:
--   gana — médico: ver/emitir/revocar SUS enlaces; administrador y secretaria:
--          los de todos los médicos de su clínica; authenticated: leer
--          reserva_avisos (metadatos globales); service_role: marcar usado.
--   pierde — anon: todo sobre las dos tablas; authenticated: DELETE,
--          TRUNCATE, REFERENCES, TRIGGER en reserva_enlaces y toda escritura
--          en reserva_avisos; service_role: DELETE/TRUNCATE en reserva_enlaces
--          y toda escritura en reserva_avisos.
--   appointments: sin cambio de permisos.
-- Contrato con spinus-consola: tablas nuevas y columnas aditivas.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   ALTER TABLE public.reserva_enlaces DROP CONSTRAINT IF EXISTS reserva_enlaces_usado_cita_fkey;
--   ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_reserva_check,
--     DROP CONSTRAINT IF EXISTS appointments_reserva_reagendados_check,
--     DROP CONSTRAINT IF EXISTS appointments_reserva_enlace_fkey,
--     DROP CONSTRAINT IF EXISTS appointments_reserva_aviso_fkey;
--   DROP INDEX IF EXISTS public.idx_appointments_reserva_enlace, public.idx_appointments_reserva_tel,
--     public.idx_appointments_reserva_correo;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS reserva_enlace_id, DROP COLUMN IF EXISTS reserva_canal,
--     DROP COLUMN IF EXISTS reserva_nombre, DROP COLUMN IF EXISTS reserva_telefono, DROP COLUMN IF EXISTS reserva_correo,
--     DROP COLUMN IF EXISTS reserva_tel_hmac, DROP COLUMN IF EXISTS reserva_correo_hmac,
--     DROP COLUMN IF EXISTS reserva_aviso_version, DROP COLUMN IF EXISTS reserva_aceptado_en,
--     DROP COLUMN IF EXISTS reserva_historial_previo, DROP COLUMN IF EXISTS reserva_reagendados;
--   DROP TABLE IF EXISTS public.reserva_enlaces; DROP TABLE IF EXISTS public.reserva_avisos;
--   DROP FUNCTION IF EXISTS public.reserva_enlace_regenerar_fijo(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.proteger_reserva_enlaces();
-- Respaldar antes:
--   CREATE TABLE respaldos.citas_reserva_AAAAMMDD AS SELECT id, reserva_enlace_id, reserva_canal,
--     reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac,
--     reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo, reserva_reagendados
--     FROM public.appointments WHERE reserva_canal IS NOT NULL;
--   CREATE TABLE respaldos.reserva_enlaces_AAAAMMDD AS SELECT * FROM public.reserva_enlaces;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tabla text;
  v_cols  text[];
  v_n     integer;
  v_c     record;
  c_enlaces CONSTANT text[] := ARRAY['id','clinica_id','medico_id','clase','codigo_hash','etiqueta','vigencia_dias',
    'caduca_en','usado_en','usado_cita_id','revocado_en','revocado_por','created_by','created_at','updated_at'];
  c_avisos  CONSTANT text[] := ARRAY['id','version','texto_sha256','aprobado','aprobado_en','created_at'];
  c_reserva CONSTANT text[] := ARRAY['reserva_enlace_id','reserva_canal','reserva_nombre','reserva_telefono',
    'reserva_correo','reserva_tel_hmac','reserva_correo_hmac','reserva_aviso_version','reserva_aceptado_en',
    'reserva_historial_previo','reserva_reagendados'];
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments','public.clinicas','public.profiles',
                                 'public.agenda_ajustes','public.tipos_cita'] LOOP
    IF to_regclass(v_tabla) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta % (¿B1 y B6 aplicadas?).', v_tabla;
    END IF;
  END LOOP;
  FOREACH v_tabla IN ARRAY ARRAY['public.appointments','public.clinicas','public.profiles'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_tabla::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de %.', current_user, v_tabla;
    END IF;
  END LOOP;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL
     OR to_regprocedure('public.get_my_role()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id(), soy_admin_de_clinica(), get_my_role() o log_tabla_change().';
  END IF;
  IF NOT (SELECT bool_and(prosecdef) FROM pg_proc
           WHERE oid IN (to_regprocedure('public.get_clinica_id()'), to_regprocedure('public.soy_admin_de_clinica()'),
                         to_regprocedure('public.get_my_role()'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: un helper de las policies ya no es SECURITY DEFINER (recursión posible).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                  AND attname = 'vigencia_enlace_unico_dias' AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'tipo_cita_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes.vigencia_enlace_unico_dias (B1) o appointments.tipo_cita_id (B6).';
  END IF;
  IF to_regclass('public.reserva_enlaces') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.reserva_enlaces'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_enlaces AND v_cols <@ c_enlaces) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_enlaces ya existe con OTRAS columnas (%).', v_cols;
    END IF;
  END IF;
  IF to_regclass('public.reserva_avisos') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.reserva_avisos'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_avisos AND v_cols <@ c_avisos) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_avisos ya existe con OTRAS columnas (%).', v_cols;
    END IF;
  END IF;
  SELECT count(*) INTO v_n FROM pg_attribute
   WHERE attrelid = 'public.appointments'::regclass AND attname = ANY (c_reserva) AND NOT attisdropped;
  IF v_n NOT IN (0, 11) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments tiene % de las 11 columnas reserva_*; a medias no se toca.', v_n;
  END IF;
  IF v_n = 11 AND EXISTS (
       SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = 'public.appointments'::regclass AND NOT a.attisdropped AND a.attname = ANY (c_reserva)
          AND format_type(a.atttypid, a.atttypmod) <> CASE
                WHEN a.attname = 'reserva_enlace_id' THEN 'uuid'
                WHEN a.attname = 'reserva_aceptado_en' THEN 'timestamp with time zone'
                WHEN a.attname IN ('reserva_historial_previo', 'reserva_reagendados') THEN 'smallint'
                ELSE 'text' END) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: alguna columna reserva_* de appointments existe con otro tipo.';
  END IF;
  IF v_n = 0 AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
       AND conname IN ('appointments_reserva_check', 'appointments_reserva_reagendados_check',
                       'appointments_reserva_enlace_fkey', 'appointments_reserva_aviso_fkey')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay constraints appointments_reserva_* sin sus columnas.';
  END IF;
  -- Las constraints se crean «si no existe ese NOMBRE» (sección 5). Un replay
  -- sobre una base con el nombre puesto y OTRA fórmula se la saltaría en
  -- silencio: aborta antes (lección de B6). Texto de pg_get_constraintdef en
  -- PG 17, sin el prefijo «public.» para no depender del search_path.
  FOR v_c IN SELECT * FROM (VALUES
      ('appointments_reserva_check', 'CHECK ((((reserva_canal IS NULL) AND (reserva_enlace_id IS NULL) AND (reserva_nombre IS NULL) AND (reserva_telefono IS NULL) AND (reserva_correo IS NULL) AND (reserva_tel_hmac IS NULL) AND (reserva_correo_hmac IS NULL) AND (reserva_aviso_version IS NULL) AND (reserva_aceptado_en IS NULL) AND (reserva_historial_previo IS NULL)) OR ((reserva_canal IS NOT NULL) AND (reserva_canal = ANY (ARRAY[''fijo''::text, ''unico''::text])) AND (reserva_enlace_id IS NOT NULL) AND (reserva_nombre IS NOT NULL) AND (btrim(reserva_nombre) <> ''''::text) AND (char_length(reserva_nombre) <= 120) AND ((reserva_telefono IS NULL) OR (reserva_telefono ~ ''^[0-9]{10}$''::text)) AND ((reserva_correo IS NULL) OR ((char_length(reserva_correo) >= 3) AND (char_length(reserva_correo) <= 254))) AND (reserva_tel_hmac IS NOT NULL) AND (reserva_tel_hmac ~ ''^[0-9a-f]{64}$''::text) AND (reserva_correo_hmac IS NOT NULL) AND (reserva_correo_hmac ~ ''^[0-9a-f]{64}$''::text) AND (reserva_aviso_version IS NOT NULL) AND (reserva_aceptado_en IS NOT NULL) AND (reserva_historial_previo IS NOT NULL) AND (reserva_historial_previo >= 0))))'),
      ('appointments_reserva_reagendados_check', 'CHECK (((reserva_reagendados >= 0) AND (reserva_reagendados <= 100)))'),
      ('appointments_reserva_enlace_fkey', 'FOREIGN KEY (reserva_enlace_id, clinica_id) REFERENCES reserva_enlaces(id, clinica_id) ON DELETE RESTRICT'),
      ('appointments_reserva_aviso_fkey', 'FOREIGN KEY (reserva_aviso_version) REFERENCES reserva_avisos(version) ON DELETE RESTRICT'),
      ('reserva_enlaces_usado_cita_fkey', 'FOREIGN KEY (usado_cita_id) REFERENCES appointments(id) ON DELETE RESTRICT')
    ) t(nombre, def) LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint k
                WHERE k.conname = v_c.nombre
                  AND k.conrelid IN ('public.appointments'::regclass, coalesce(to_regclass('public.reserva_enlaces'), 0::oid::regclass))
                  AND replace(pg_get_constraintdef(k.oid), 'public.', '') <> v_c.def) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % existe con OTRA fórmula; revisar a mano antes de seguir.', v_c.nombre;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (to_regprocedure('public.proteger_reserva_enlaces()'),
               to_regprocedure('public.reserva_enlace_regenerar_fijo(uuid, uuid, text)')) AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función de D1 existe como SECURITY DEFINER; tienen que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · reserva_avisos: sólo el editor SQL escribe.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserva_avisos (
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
ALTER TABLE public.reserva_avisos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reserva_avisos FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.reserva_avisos TO authenticated, service_role;
DROP POLICY IF EXISTS reserva_avisos_select ON public.reserva_avisos;
CREATE POLICY reserva_avisos_select ON public.reserva_avisos FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- 3 · reserva_enlaces, su RLS y sus permisos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserva_enlaces (
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
  CONSTRAINT reserva_enlaces_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_enlaces_id_clinica_key UNIQUE (id, clinica_id),
  CONSTRAINT reserva_enlaces_codigo_key UNIQUE (codigo_hash),
  CONSTRAINT reserva_enlaces_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_enlaces_medico_id_fkey  FOREIGN KEY (medico_id)  REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_enlaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_enlaces_revocado_por_fkey FOREIGN KEY (revocado_por) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reserva_enlaces_clase_check CHECK (clase IN ('fijo', 'unico')),
  CONSTRAINT reserva_enlaces_codigo_check CHECK (codigo_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reserva_enlaces_etiqueta_check CHECK (etiqueta IS NULL OR (btrim(etiqueta) <> '' AND char_length(etiqueta) <= 60)),
  CONSTRAINT reserva_enlaces_vigencia_check CHECK (
    (clase = 'unico' AND vigencia_dias IS NOT NULL AND vigencia_dias BETWEEN 1 AND 30 AND caduca_en IS NOT NULL)
    OR (clase = 'fijo' AND vigencia_dias IS NULL AND caduca_en IS NULL)),
  CONSTRAINT reserva_enlaces_uso_check CHECK (
    ((usado_en IS NULL) = (usado_cita_id IS NULL)) AND (usado_en IS NULL OR clase = 'unico')),
  CONSTRAINT reserva_enlaces_revocado_check CHECK (revocado_por IS NULL OR revocado_en IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS reserva_enlaces_fijo_vigente ON public.reserva_enlaces (clinica_id, medico_id)
  WHERE clase = 'fijo' AND revocado_en IS NULL;
CREATE INDEX IF NOT EXISTS reserva_enlaces_por_medico ON public.reserva_enlaces (clinica_id, medico_id, created_at DESC);

ALTER TABLE public.reserva_enlaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reserva_enlaces FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reserva_enlaces FROM authenticated;
REVOKE DELETE, TRUNCATE ON TABLE public.reserva_enlaces FROM service_role;

-- Sin recursión: ninguna policy lee reserva_enlaces. Sin policy de DELETE.
DROP POLICY IF EXISTS reserva_enlaces_select ON public.reserva_enlaces;
CREATE POLICY reserva_enlaces_select ON public.reserva_enlaces FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS reserva_enlaces_insert ON public.reserva_enlaces;
CREATE POLICY reserva_enlaces_insert ON public.reserva_enlaces FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));
DROP POLICY IF EXISTS reserva_enlaces_update ON public.reserva_enlaces;
CREATE POLICY reserva_enlaces_update ON public.reserva_enlaces FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'))
  WITH CHECK (clinica_id = public.get_clinica_id()
              AND (medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria'));

-- ---------------------------------------------------------------------
-- 4 · Protección: INVOKER, decide con current_user (patrón de B1).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_reserva_enlaces()
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
    NEW.created_by    := auth.uid();
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
    NEW.revocado_por := auth.uid();
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

REVOKE EXECUTE ON FUNCTION public.proteger_reserva_enlaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteger_reserva_enlaces() TO anon, authenticated, service_role;

-- Regenerar el fijo: revocar el vigente y emitir otro en UNA transacción, con
-- la RLS de quien llama. Más cerrada que la regla general (sin anon): un
-- anónimo no tiene sesión ni clínica.
CREATE OR REPLACE FUNCTION public.reserva_enlace_regenerar_fijo(p_id uuid, p_medico_id uuid, p_codigo_hash text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_clinica uuid := public.get_clinica_id();
BEGIN
  IF p_id IS NULL OR p_medico_id IS NULL OR p_codigo_hash IS NULL OR v_clinica IS NULL THEN
    RAISE EXCEPTION 'reserva_enlace_regenerar_fijo: argumentos o sesión inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reserva_enlaces
     SET revocado_en = now()
   WHERE clinica_id = v_clinica AND medico_id = p_medico_id AND clase = 'fijo' AND revocado_en IS NULL;
  INSERT INTO public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
  VALUES (p_id, v_clinica, p_medico_id, 'fijo', p_codigo_hash);
  RETURN p_id;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.reserva_enlace_regenerar_fijo(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserva_enlace_regenerar_fijo(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_reserva_enlaces_proteger
  BEFORE INSERT OR UPDATE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_enlaces();
CREATE OR REPLACE TRIGGER audit_reserva_enlaces
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE OR REPLACE TRIGGER audit_reserva_avisos
  AFTER INSERT OR UPDATE OR DELETE ON public.reserva_avisos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 5 · appointments: columnas, FK compuesta (misma clínica), FK al aviso,
--     CHECK de coherencia e índices parciales del candado.
-- ---------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_enlace_id uuid;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_canal text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_nombre text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_telefono text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_correo text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_tel_hmac text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_correo_hmac text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_aviso_version text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_aceptado_en timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_historial_previo smallint;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reserva_reagendados smallint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_reserva_enlace_fkey') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_reserva_enlace_fkey
      FOREIGN KEY (reserva_enlace_id, clinica_id) REFERENCES public.reserva_enlaces (id, clinica_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_reserva_aviso_fkey') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_reserva_aviso_fkey
      FOREIGN KEY (reserva_aviso_version) REFERENCES public.reserva_avisos (version) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_reserva_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_reserva_check CHECK (
      (reserva_canal IS NULL AND reserva_enlace_id IS NULL AND reserva_nombre IS NULL AND reserva_telefono IS NULL
       AND reserva_correo IS NULL AND reserva_tel_hmac IS NULL AND reserva_correo_hmac IS NULL
       AND reserva_aviso_version IS NULL AND reserva_aceptado_en IS NULL AND reserva_historial_previo IS NULL)
      OR
      -- Cada columna con su IS NOT NULL explícito: un CHECK que evalúa a NULL
      -- PASA, y `NULL ~ '…'` o `btrim(NULL) <> ''` dan NULL.
      (reserva_canal IS NOT NULL AND reserva_canal IN ('fijo', 'unico') AND reserva_enlace_id IS NOT NULL
       AND reserva_nombre IS NOT NULL AND btrim(reserva_nombre) <> '' AND char_length(reserva_nombre) <= 120
       AND (reserva_telefono IS NULL OR reserva_telefono ~ '^[0-9]{10}$')
       AND (reserva_correo IS NULL OR char_length(reserva_correo) BETWEEN 3 AND 254)
       AND reserva_tel_hmac IS NOT NULL AND reserva_tel_hmac ~ '^[0-9a-f]{64}$'
       AND reserva_correo_hmac IS NOT NULL AND reserva_correo_hmac ~ '^[0-9a-f]{64}$'
       AND reserva_aviso_version IS NOT NULL AND reserva_aceptado_en IS NOT NULL
       AND reserva_historial_previo IS NOT NULL AND reserva_historial_previo >= 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
                  AND conname = 'appointments_reserva_reagendados_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_reserva_reagendados_check
      CHECK (reserva_reagendados BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.reserva_enlaces'::regclass
                  AND conname = 'reserva_enlaces_usado_cita_fkey') THEN
    ALTER TABLE public.reserva_enlaces ADD CONSTRAINT reserva_enlaces_usado_cita_fkey
      FOREIGN KEY (usado_cita_id) REFERENCES public.appointments (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_reserva_enlace ON public.appointments (reserva_enlace_id)
  WHERE reserva_enlace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_reserva_tel ON public.appointments (clinica_id, medico_id, reserva_tel_hmac)
  WHERE reserva_canal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_reserva_correo ON public.appointments (clinica_id, medico_id, reserva_correo_hmac)
  WHERE reserva_canal IS NOT NULL;

COMMENT ON TABLE public.reserva_enlaces IS
  'Enlaces de reserva (agenda D1). El código NO se guarda: se deriva en el servidor (HMAC con RESERVA_SECRETO sobre el id) y aquí sólo vive sha256(código). Un fijo vigente por médico; los únicos congelan vigencia_dias/caduca_en al emitir. Se revocan, nunca se borran. Rotar RESERVA_SECRETO invalida TODOS los enlaces.';
COMMENT ON TABLE public.reserva_avisos IS
  'Versiones del aviso de privacidad de la reserva por enlace. Sólo el editor SQL aprueba. Sin una versión aprobada cuyo texto_sha256 coincida con el texto del código (src/lib/reserva/avisoReserva.ts), ningún enlace reserva.';
COMMENT ON COLUMN public.appointments.reserva_canal IS
  'fijo | unico = la cita nació de una reserva por enlace (D). «Por ligar» = reserva_canal no nulo y paciente_id nulo. CONVENIO: una cita por ligar se trata como cita (no como evento genérico) en tarjetas, conteos, cancelación (B3) y tipo de cita; y su título NO lo cambia Google (C-d). Teléfono, correo y *_hmac nunca viajan a Google (S1).';
COMMENT ON COLUMN public.appointments.reserva_tel_hmac IS
  'HMAC-SHA256 (hex) del teléfono normalizado con la subllave «contacto» de RESERVA_SECRETO. Llave del candado (D2) junto con reserva_correo_hmac. Rotar el secreto rompe el historial.';
COMMENT ON COLUMN public.appointments.reserva_telefono IS
  'Teléfono de quien reservó (10 dígitos). Puede quedar NULL tras una supresión ARCO; los *_hmac se quedan para el candado.';
COMMENT ON COLUMN public.appointments.reserva_enlace_id IS
  'Enlace de reserva_enlaces del que nació la cita (D1). La FK compuesta (reserva_enlace_id, clinica_id) impide colgarla de un enlace de otra clínica. Va junto con reserva_canal (appointments_reserva_check).';
COMMENT ON COLUMN public.appointments.reserva_nombre IS
  'Nombre de quien reservó por enlace, sin paciente todavía (D1). Se queda en la cita al ligarla a un paciente.';
COMMENT ON COLUMN public.appointments.reserva_correo IS
  'Correo de quien reservó. Aquí sólo se valida la longitud; la forma la valida el servidor (Zod) y reservar_por_enlace exige una arroba. Puede quedar NULL tras una supresión ARCO; reserva_correo_hmac se queda para el candado.';
COMMENT ON COLUMN public.appointments.reserva_correo_hmac IS
  'HMAC-SHA256 (hex) del correo normalizado con la subllave «contacto» de RESERVA_SECRETO. Llave del candado (D2) junto con reserva_tel_hmac. Rotar el secreto rompe el historial.';
COMMENT ON COLUMN public.appointments.reserva_aviso_version IS
  'Versión de reserva_avisos que aceptó quien reservó (FK). Sin una versión aprobada con el mismo texto_sha256 que el código, no se reserva (D3).';
COMMENT ON COLUMN public.appointments.reserva_aceptado_en IS
  'Cuándo aceptó quien reservó el aviso de reserva_aviso_version.';
COMMENT ON COLUMN public.appointments.reserva_historial_previo IS
  'Cancelaciones + inasistencias que el contacto traía con ese médico AL RESERVAR (instantánea que escribe reservar_por_enlace; no se recalcula). CONVENIO QUE LA BASE NO IMPONE: nada revalida que el número fuera el real en ese instante.';
COMMENT ON COLUMN public.appointments.reserva_reagendados IS
  'Veces que una cita por enlace se reagendó por el camino de reagendar (llega en el bloque E; tope candado_reagendados de agenda_ajustes). 0 en toda otra cita; NOT NULL DEFAULT 0 para que la columna nazca sin reescribir la tabla.';
COMMENT ON COLUMN public.appointments.tipo_cita_id IS
  'Tipo de la cita (agenda B6). La FK compuesta garantiza la misma clínica. CONVENIO QUE LA BASE NO IMPONE: el tipo es de toda la clínica (medico_id NULL) o del medico_id de la cita, y la cita tiene paciente O está por ligar (reserva_canal no nulo, D1). Lo comprueban reservar_por_enlace (D3) y POST/PUT /api/appointments (validarTipoParaCita en src/lib/agenda/tiposCita.ts, que mientras no se amplíe sólo admite tipo con paciente). Un camino que escriba la columna sin pasar por ahí puede dejar un tipo de otro médico sin que nada lo note.';

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_enlaces / reserva_avisos: RLS' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_enlaces')), 'AUSENTE')
         || ' / ' || coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_avisos')), 'AUSENTE') AS valor,
         'true / true' AS esperado
  UNION ALL
  SELECT 2, 'policies reserva_enlaces (sin DELETE) / reserva_avisos',
         coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_enlaces'), '-')
         || ' / ' || coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_avisos'), '-'),
         'INSERT,SELECT,UPDATE / SELECT'
  UNION ALL
  SELECT 3, 'FKs de reserva_enlaces',
         coalesce((SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.reserva_enlaces') AND contype = 'f'), '-'),
         'reserva_enlaces_clinica_id_fkey=r,reserva_enlaces_created_by_fkey=n,reserva_enlaces_medico_id_fkey=r,reserva_enlaces_revocado_por_fkey=n,reserva_enlaces_usado_cita_fkey=r'
  UNION ALL
  SELECT 4, 'appointments: FKs y CHECK de la reserva',
         (SELECT string_agg(conname || '=' || contype::text || coalesce(confdeltype::text, ''), ',' ORDER BY conname) FROM pg_constraint
           WHERE conrelid = 'public.appointments'::regclass AND conname LIKE 'appointments_reserva_%'),
         'appointments_reserva_aviso_fkey=fr,appointments_reserva_check=c ,appointments_reserva_enlace_fkey=fr,appointments_reserva_reagendados_check=c '
  UNION ALL
  SELECT 5, 'appointments: las 11 columnas reserva_*',
         (SELECT count(*)::text FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
           AND attname LIKE 'reserva\_%' AND NOT attisdropped),
         '11'
  UNION ALL
  SELECT 6, 'índices parciales del candado y del fijo vigente',
         (SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public'
           AND indexname IN ('idx_appointments_reserva_enlace', 'idx_appointments_reserva_tel', 'idx_appointments_reserva_correo',
                             'reserva_enlaces_fijo_vigente')),
         'idx_appointments_reserva_correo,idx_appointments_reserva_enlace,idx_appointments_reserva_tel,reserva_enlaces_fijo_vigente'
  UNION ALL
  SELECT 7, 'funciones: definer / EXECUTE anon,authenticated,service_role',
         coalesce((SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                    || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
                     FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.proteger_reserva_enlaces()'),
                       to_regprocedure('public.reserva_enlace_regenerar_fijo(uuid, uuid, text)'))), '-'),
         'proteger_reserva_enlaces=false/true,true,true ; reserva_enlace_regenerar_fijo=false/false,true,true'
  UNION ALL
  SELECT 8, 'disparadores de reserva_enlaces',
         coalesce((SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
                    WHERE tgrelid = to_regclass('public.reserva_enlaces') AND NOT tgisinternal AND tgenabled = 'O'), '-'),
         'audit_reserva_enlaces,trg_reserva_enlaces_proteger'
  UNION ALL
  SELECT 9, 'privilegios anon / authenticated / service_role en reserva_enlaces',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_enlaces' AND grantee = 'anon'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_enlaces' AND grantee = 'authenticated'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_enlaces' AND grantee = 'service_role'), '-'),
         '- / INSERT,SELECT,UPDATE / INSERT,REFERENCES,SELECT,TRIGGER,UPDATE'
  UNION ALL
  SELECT 10, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 12, 'fórmula de appointments_reserva_check (md5, sin «public.»)',
         coalesce((SELECT md5(replace(pg_get_constraintdef(oid), 'public.', '')) FROM pg_constraint
                    WHERE conrelid = 'public.appointments'::regclass AND conname = 'appointments_reserva_check'), 'AUSENTE'),
         '12f5eb0a7cae5d1b7813634001f9c5c4'
  UNION ALL
  SELECT 11, 'censo: citas por enlace / enlaces / avisos aprobados',
         (SELECT count(*)::text FROM public.appointments WHERE reserva_canal IS NOT NULL) || ' / '
         || (SELECT count(*)::text FROM public.reserva_enlaces) || ' / '
         || (SELECT count(*)::text FROM public.reserva_avisos WHERE aprobado), NULL
) t
ORDER BY t.n;
